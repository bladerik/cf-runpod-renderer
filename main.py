import asyncio
import base64
import json
import subprocess 
import runpod
import envkey
import os
import tempfile
import uuid

async def js_handler(data: dict, timeout_seconds: int = 600):  # Default 10 minutes timeout
    random_id = uuid.uuid4().hex[:8]
    temp_file_path = f'/tmp/scene_data_{random_id}.json'
    output_file_path = f'/tmp/scene_output_{random_id}.json'
    
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

    # this is not required because requests needs to be authenticated anyway
    # authorization = job_input["authorization"]
    # if authorization != os.environ.get("AUTH_TOKEN"):
    #     return {"error": "Invalid authorization"}

    return js_handler(job_input)


runpod.serverless.start({
    "handler": handler
})