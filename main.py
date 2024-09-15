import asyncio
import base64
import json
import subprocess 
import runpod
import envkey

from playwright.async_api import async_playwright


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
            vulkan_info = subprocess.check_output(["vulkaninfo"]).decode()
        except subprocess.CalledProcessError:
            vulkan_info = "Vulkan info not available: Command failed"
        except FileNotFoundError:
            vulkan_info = "Vulkan info not available: Command not found"


        

        await browser.close()

        return {
            "gpu_info_text": gpu_info_text,
        "vulkan_info": vulkan_info,
        }
        
async def render_pixi_scene(data: dict):
    scene_props = data['options']
    scene = data['scene']
    fonts = data['fonts']

    width = scene['width']
    height = scene['height']
    fps = scene['fps']
    from_frame = scene_props.get('from_frame', 0)
    to_frame = scene_props.get('to_frame', None)
    transparent = scene_props.get('transparent', False)
    quality = scene_props.get('quality', 100)
    extension = "png" if transparent else "jpg"

    default_args = [
        '--no-sandbox',
        '--mute-audio',
    ]

    # Use custom args from data['options'] if present, otherwise use default_args
    browser_args = scene_props.get('browser_args', default_args)
    print("Initializing browser...")
    async with async_playwright() as p:
        browser = await p.firefox.launch(
            headless=False,
            # channel="chrome",
            # args=browser_args
        )

        page = await browser.new_page(viewport={'width': width, 'height': height})

        print("Loading scene...")
        await page.goto("https://content.renderfries.com/public/app/scene-pixi.html")

        await page.evaluate("""
        (props) => {
            const canvas = document.createElement("canvas");
            canvas.id = "cf-canvas";
            canvas.width = props.width;
            canvas.height = props.height;
            const gl = canvas.getContext("webgl", {stencil: true, preserveDrawingBuffer: true});
            document.body.appendChild(canvas);
        }
        """, {"width": width, "height": height})

        print("WebGL context ready")
        await asyncio.sleep(2)

        browser_data = {
            "scene": scene,
            "fps": fps,
            "fonts": fonts
        }

        result = await page.evaluate("""
        (data) => {
            try {
                window.SCENE = data.scene;
                window.FPS = data.fps;
                window.FONTS = data.fonts;
                window.loadScene()
                return { success: true, message: 'Data added successfully' };
            } catch (error) {
                console.error('Error in loadScene:', error);
                return { success: false, error: error.toString() };
            }
        }
        """, browser_data)
        print("Evaluate result:", result)

        try:
            await page.wait_for_selector("#cf-animation-loaded", state="attached", timeout=10000)
            print("scene loaded")
        except Exception as e:
            print(f"Error waiting for #cf-animation-loaded: {e}")

        total_frames = await page.evaluate('window.getTotalFrames()')
        if not total_frames:
            total_frames = int(scene['duration'] * fps)

        to_frame = to_frame or total_frames

        print(f"Rendering frames from {from_frame} to {to_frame}")

        frames = []

        for i in range(from_frame, to_frame + 1):
            await page.evaluate(f'window.setFrame({i})')
            await page.wait_for_selector(f"#frame-{i}", state="attached", timeout=5000)

            frame_data = await page.evaluate(f"""
                () => {{
                    const canvas = document.querySelector("#cf-canvas");
                    return canvas.toDataURL('image/{"png" if transparent else "jpeg"}', {quality/100});
                }}
            """)

            frames.append(frame_data)
            print(f"Frame {i} captured")

        await browser.close()

        return {"frames": frames}

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