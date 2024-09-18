import asyncio
import base64
import json
import subprocess 
import runpod
import envkey
import os
import tempfile

from browser import BrowserSceneRenderer

from playwright.async_api import async_playwright

def find_nvidia_json_files():
    nvidia_files = []
    for root, dirs, files in os.walk('/'):
        for file in files:
            if 'nvidia' in file.lower() and file.lower().endswith('.json'):
                nvidia_files.append(os.path.join(root, file))
    return nvidia_files

async def gpu_info(data: dict):
    # print("NVIDIA SMI Output:")
    # print(subprocess.check_output(["nvidia-smi"]).decode())
        # Check NVIDIA-SMI

    # print("Vulkan Info:")
    # print(subprocess.check_output(["vulkaninfo"]).decode())


    try:
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

    # Use custom args from data['options'] if present, otherwise use default_args
    browser_args = scene_props.get('browser_args', default_args)

    print("Initializing browser...")
    print(browser_args)

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            channel="chrome",
            ignore_default_args=["--headless"],
            args=browser_args
        )

        page = await browser.new_page(viewport={'width': width, 'height': height})
        await page.goto("chrome://gpu")

        download_path = '/tmp/gpu_info.txt'
        async with page.expect_download() as download_info:
            await page.click('#download-to-file')

        download = await download_info.value
        await download.save_as(download_path)

        with open(download_path, 'r') as f:
            gpu_info_text = f.read()

        vulkan_info = ""
        try:
            print("Vulkan Info:")
            vulkan_info = subprocess.check_output("vulkaninfo | grep -i 'gpu id'", shell=True).decode()
        except subprocess.CalledProcessError:
            vulkan_info = "Vulkan info not available: Command failed"
        except FileNotFoundError:
            vulkan_info = "Vulkan info not available: Command not found"


        # Find and print NVIDIA JSON files
        print("Searching for NVIDIA JSON files...")
        nvidia_files = find_nvidia_json_files()
        print("Found NVIDIA JSON files:")
        for file in nvidia_files:
            print(file)

        await browser.close()

        return {
            "gpu_info_text": gpu_info_text,
            "vulkan_info": vulkan_info,
        }
        

async def render_pixi_scene(data: dict, timeout_seconds: int = 600):  # Default 10 minutes timeout
    temp_file_path = '/tmp/scene_data.json'
    output_file_path = '/tmp/scene_output.json'
    
    with open(temp_file_path, 'w') as temp_file:
        json.dump(data, temp_file)

    print("Rendering pixi scene...", temp_file_path)
    try:
        cmd = ['node', 'start.esm.js', temp_file_path, output_file_path]
        
        async def run_node_app():
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await process.communicate()
            return process.returncode, stdout, stderr

        try:
            returncode, stdout, stderr = await asyncio.wait_for(run_node_app(), timeout=timeout_seconds)
        except asyncio.TimeoutError:
            return {"error": f"Node.js app timed out after {timeout_seconds} seconds"}

        if returncode != 0:
            return {"error": f"Node.js app error: {stderr.decode()}"}
        
        # Print any console output from the Node.js app
        print("Node.js app stdout:", stdout.decode())
        print("Node.js app stderr:", stderr.decode())

        # Read the result from the output file
        try:
            with open(output_file_path, 'r') as output_file:
                result = json.load(output_file)
            return result
        except json.JSONDecodeError:
            return {"error": "Failed to parse Node.js app output"}
        except FileNotFoundError:
            return {"error": "Node.js app did not produce an output file"}
    
    finally:
        # Clean up temporary files
        print("done")
        # for file_path in [temp_file_path, output_file_path]:
            # if os.path.exists(file_path):
                # os.unlink(file_path)

def handler(event):
    job_input = event["input"]
    event = job_input["event"]

    # authorization = job_input["authorization"]
    # if authorization != os.environ.get("AUTH_TOKEN"):
    #     return {"error": "Invalid authorization"}

    if event == "gpu_info":
        return gpu_info(job_input)
    elif event == "render":
        return render_pixi_scene(job_input)

    return {"error": "Invalid event " + event}


runpod.serverless.start({
    "handler": handler
})