import asyncio
import base64
import json
import subprocess 
import envkey
from browser import BrowserSceneRenderer
from playwright.async_api import async_playwright
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from celery import Celery
from celery.result import AsyncResult

app = FastAPI()

# Celery configuration
celery = Celery(
    'tasks',
    broker='redis://localhost:6379/0',
    backend='redis://localhost:6379/0'
)

celery.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
)

class JobInput(BaseModel):
    input: dict

def run_async(coro):
    return asyncio.get_event_loop().run_until_complete(coro)

@celery.task(name="gpu_info", bind=True)
def gpu_info(self, data: dict):
    self.update_state(state='PROGRESS', meta={'status': 'Initializing GPU info collection'})
    
    try:
        self.update_state(state='PROGRESS', meta={'status': 'Checking NVIDIA-SMI'})
        nvidia_smi = subprocess.check_output(["nvidia-smi"]).decode()
        print("NVIDIA-SMI output:")
        print(nvidia_smi)
    except subprocess.CalledProcessError:
        print("nvidia-smi command failed. NVIDIA driver might not be installed or accessible.")

    scene = data['scene']
    width = scene['width']
    height = scene['height']
    scene_props = data['options']

    default_args = [
        "--enable-features=Vulkan,UseSkiaRenderer",
        "--use-vulkan=swiftshader",
        "--use-gl=swiftshader",
        "--ignore-gpu-blacklist",
        "--enable-unsafe-webgpu",
        "--disable-vulkan-fallback-to-gl-for-testing",
        "--use-angle=vulkan"
    ]

    browser_args = scene_props.get('browser_args', default_args)

    self.update_state(state='PROGRESS', meta={'status': 'Initializing browser'})
    print("Initializing browser...")
    print(browser_args)

    # Note: We can't use async with Playwright here, so we'll use sync version
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(
            channel="chrome",
            ignore_default_args=["--headless"],
            args=browser_args
        )

        self.update_state(state='PROGRESS', meta={'status': 'Collecting GPU information'})
        page = browser.new_page(viewport={'width': width, 'height': height})
        page.goto("chrome://gpu")

        download_path = '/tmp/gpu_info.txt'
        with page.expect_download() as download_info:
            page.click('#download-to-file')

        download = download_info.value
        download.save_as(download_path)

        with open(download_path, 'r') as f:
            gpu_info_text = f.read()

        self.update_state(state='PROGRESS', meta={'status': 'Collecting Vulkan information'})
        vulkan_info = ""
        try:
            print("Vulkan Info:")
            vulkan_info = subprocess.check_output(["vulkaninfo"]).decode()
        except subprocess.CalledProcessError:
            vulkan_info = "Vulkan info not available: Command failed"
        except FileNotFoundError:
            vulkan_info = "Vulkan info not available: Command not found"

        browser.close()

        self.update_state(state='SUCCESS', meta={'status': 'GPU info collection completed'})
        return {
            "gpu_info_text": gpu_info_text,
            "vulkan_info": vulkan_info,
        }
        
        
@celery.task(name="render_pixi_scene", bind=True)
def render_pixi_scene(self, data: dict):
    async def async_render_pixi_scene():
        renderer = BrowserSceneRenderer(data)
        await renderer.start_browser()
        video = await renderer.render()

        return {"video": video}
    
    return run_async(async_render_pixi_scene())

@app.post("/submit_job")
async def submit_job(job_input: JobInput):
    event_type = job_input.input["event"]
    
    if event_type == "gpu_info":
        task = gpu_info.delay(job_input.input)
    elif event_type == "render":
        task = render_pixi_scene.delay(job_input.input)
    else:
        raise HTTPException(status_code=400, detail=f"Invalid event {event_type}")
    
    return {"job_id": task.id}

@app.get("/job_status/{job_id}")
async def get_job_status(job_id: str):
    task = AsyncResult(job_id, app=celery)
    if task.state == 'PENDING':
        response = {
            'state': task.state,
            'status': 'Job is currently in the queue'
        }
    elif task.state != 'FAILURE':
        response = {
            'state': task.state,
            'status': task.info.get('status', '') if task.info else 'No result yet'
        }
        if 'result' in task.info:
            response['result'] = task.info['result']
    else:
        response = {
            'state': task.state,
            'status': str(task.info),
        }
    return response

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)