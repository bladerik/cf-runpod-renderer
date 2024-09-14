
FROM nvidia/opengl:1.2-glvnd-runtime-ubuntu22.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Needed to share GPU
ENV NVIDIA_DRIVER_CAPABILITIES=all
ENV NVIDIA_VISIBLE_DEVICES=all

# RUN apt-get update \
#     && apt-get install -y software-properties-common libvulkan1

RUN apt-get update && apt-get install -y --no-install-recommends \
        git \
        ca-certificates \
        build-essential \
        g++ \
        libxinerama-dev \
        libxext-dev \
        libxrandr-dev \
        libxi-dev \
        libxcursor-dev \
        libxxf86vm-dev \
        libvulkan-dev && \
        python3 \
        python3-pip \
        rm -rf /var/lib/apt/lists/*

RUN pip3 install playwright
RUN playwright install-deps
RUN playwright install chrome
# Install Python dependencies
COPY requirements.txt /app/requirements.txt
RUN pip3 install --no-cache-dir -r /app/requirements.txt

# Set up the working directory
WORKDIR /app

# Copy the application code
COPY . /app

# Expose the port your application will run on
EXPOSE 8000

# reset entrypoint
ENTRYPOINT ["/bin/bash", "-c"]

# Command to run the application
CMD ["python3", "main.py"]