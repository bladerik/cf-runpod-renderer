import os
from typing import Any, Dict, List
from playwright.async_api import async_playwright, Browser
from io import BytesIO
import ffmpeg
import asyncio
import time
import base64
from PIL import Image
import io

class BrowserSceneRenderer:
    def __init__(self, data: Dict[str, Any]):
        # Assume SceneShape.safeParse is not available, so we skip the shape check
        self.scene = data['scene']
        self.subtitles = data.get('subtitles', {})
        self.fonts = data.get('fonts', [])

        self.render_mode = data.get('renderMode', 'server')
        self.debug = data.get('debug', False)
        self.render_on_seek = data.get('renderOnSeek', True)
        self.render_frame_format = data.get('renderFrameFormat', 'jpg')
        self.render_frame_quality = data.get('renderFrameQuality', 0.8)
        self.concurrency = data.get('concurrency', 1)
        self.browser_type = data.get('browserType', 'firefox')
        self.output_video_path = data.get('outputVideoPath', f"output_{int(time.time())}.mp4")
        
        WORKDIR = os.path.join(os.environ.get('RESOURCES_DIR', '/tmp'), f"render/{self.scene['id']}")
        os.makedirs(WORKDIR, exist_ok=True)
        os.makedirs(os.path.join(WORKDIR, "tmp"), exist_ok=True)
        self.workdir = WORKDIR

        self.from_frame = data.get('fromFrame', 1)
        self.to_frame = data.get('toFrame', round(self.scene['duration'] * self.scene['fps']))

    def set_concurrency(self, concurrency: int):
        self.concurrency = concurrency

    async def start_browser(self, headless: bool = False):
        if hasattr(self, 'browser'):
            return

        self.playwright = await async_playwright().start()
        if self.browser_type == 'firefox':
            self.browser = await self.playwright.firefox.launch(
                headless=headless,
                firefox_user_prefs={
                    "security.fileuri.strict_origin_policy": False,
                    "webgl.force-enabled": True,
                    "layers.acceleration.force-enabled": True,
                    "gfx.webrender.all": True,
                    "gfx.webrender.enabled": True,
                    "gfx.canvas.azure.accelerated": True,
                    "media.hardware-video-decoding.force-enabled": True,
                }
            )
        else:
            self.browser = await self.playwright.chromium.launch(
                channel=self.browser_type,
                headless=headless
            )

    async def render_chunk(self, from_frame: int, to_frame: int):
        page = await self.browser.new_page()
        frames = []

        if self.debug:
            page.on("console", lambda msg: print(f"[PAGE {msg.type[:3].upper()}] {msg.text}"))
            page.on("pageerror", lambda err: print(f"[PAGE ERROR] {err}"))
            print("Loading scene...")

        await page.goto("https://content.renderfries.com/public/app/scene-pixi.html")

        await page.evaluate("""
            ({width, height}) => {
                const canvas = document.createElement('div');
                canvas.id = 'cf-canvas';
                canvas.style.width = width + 'px';
                canvas.style.height = height + 'px';
                document.body.appendChild(canvas);
            }
        """, {"width": self.scene['width'], "height": self.scene['height']})

        print("Container ready")

        browser_data = {
            "scene": self.scene,
            "fps": self.scene['fps'],
            "fonts": self.fonts,
            "subtitles": self.subtitles,
            "renderMode": self.render_mode,
            "debug": self.debug,
            "renderOnSeek": self.render_on_seek,
            "renderFrameFormat": self.render_frame_format,
            "renderFrameQuality": self.render_frame_quality,
        }

        result = await page.evaluate("""
            (data) => {
                try {
                    window.SCENE = data.scene;
                    window.FPS = data.fps;
                    window.FONTS = data.fonts;
                    window.SUBTITLES = data.subtitles;
                    window.RENDER_MODE = data.renderMode;
                    window.DEBUG = data.debug;
                    window.RENDER_ON_SEEK = data.renderOnSeek;
                    window.RENDER_FRAME_FORMAT = data.renderFrameFormat;
                    window.RENDER_FRAME_QUALITY = data.renderFrameQuality;
                    window.loadScene();
                    return {
                        success: true,
                        message: "Data added successfully",
                    };
                } catch (error) {
                    console.error("Error in loadScene:", error);
                    return { success: false, error: error.toString() };
                }
            }
        """, browser_data)
        print("Evaluate result:", result)

        await page.wait_for_selector("#cf-animation-loaded", timeout=50000, state="attached")

        total_frames = await page.evaluate("window.getTotalFrames()")
        if not total_frames:
            total_frames = int(self.scene['duration'] * self.scene['fps'])

        to_frame = to_frame or total_frames

        print(f"Rendering frames from {from_frame} to {to_frame}")

        for i in range(from_frame, to_frame + 1):
            frame_data = await page.evaluate(f"window.setFrame({i})")
            if frame_data:
                # Decode base64 to bytes                
                header, encoded = frame_data.split(",", 1)
                image_format = header.split(";")[0].split("/")[1]
                # Decode base64 to bytes
                frame_bytes = base64.b64decode(encoded)

                frames.append(frame_bytes)
            elif self.debug:
                print(f"Frame {i} not captured, frameData empty")

        await page.close()

        # Debug: Print information about the frames
        print(f"Number of frames: {len(frames)}")
        if frames:
            print(f"First frame data length: {len(frames[0])} bytes")

        chunk_output_path = f"{self.workdir}/chunk_{from_frame}_{to_frame}.mp4"

        try:
            # Create a readable stream from frames
            input_stream = io.BytesIO(b''.join(frames))

            # Use ffmpeg-python with image2pipe input
            (
                ffmpeg
                .input('pipe:', format='image2pipe', pix_fmt='rgb24', s=f'{self.scene["width"]}x{self.scene["height"]}', r=self.scene['fps'])
                .output(chunk_output_path, vcodec='libx264', pix_fmt='yuv420p', preset='medium', crf='23')
                .overwrite_output()
                .global_args('-loglevel', 'info')
                .run(input=input_stream.read(), capture_stdout=True, capture_stderr=True)
            )
            print(f"Video chunk saved to {chunk_output_path}")
        except ffmpeg.Error as e:
            print('stdout:', e.stdout.decode('utf8'))
            print('stderr:', e.stderr.decode('utf8'))
            raise

        # Verify the output video
        try:
            probe = ffmpeg.probe(chunk_output_path)
            video_info = next(s for s in probe['streams'] if s['codec_type'] == 'video')
            print(f"Output video info: {video_info}")
        except ffmpeg.Error as e:
            print(f"Error probing output video: {str(e)}")

        return chunk_output_path

    async def render(self):
        try:
            await self.start_browser()

            from_frame = self.from_frame
            to_frame = self.to_frame
            total_frames = to_frame - from_frame + 1

            chunk_paths = []

            if self.concurrency > 1 and total_frames > 30:
                min_frames_per_chunk = 30
                max_workers = min(20, self.concurrency)
                frames_per_worker = max(min_frames_per_chunk, (total_frames + max_workers - 1) // max_workers)
                chunks = []

                for start in range(from_frame, to_frame + 1, frames_per_worker):
                    end = min(start + frames_per_worker - 1, to_frame)
                    chunks.append((start, end))

                chunk_paths = await asyncio.gather(*[self.render_chunk(chunk[0], chunk[1]) for chunk in chunks])
            else:
                single_chunk_path = await self.render_chunk(from_frame, to_frame)
                chunk_paths = [single_chunk_path]

            output = await self.merge_video_chunks(chunk_paths)
            print("-- video rendered! --", output)

            for path in chunk_paths:
                os.remove(path)

            return output
        except Exception as error:
            print("Error starting browser:", error)
            raise
        finally:
            if hasattr(self, 'browser'):
                await self.browser.close()
            if hasattr(self, 'playwright'):
                await self.playwright.stop()

    async def merge_video_chunks(self, chunk_paths: List[str]) -> str:
        output_path = os.path.join(self.workdir, self.output_video_path)
        
        input_streams = [ffmpeg.input(path) for path in chunk_paths]
        
        (
            ffmpeg
            .concat(*input_streams)
            .output(output_path)
            .overwrite_output()
            .run()
        )
        
        print("Video chunks merged successfully")
        return output_path

# Usage example:
# renderer = BrowserSceneRenderer(data)
# asyncio.run(renderer.render())