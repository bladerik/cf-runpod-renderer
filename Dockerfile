# FROM nvidia/cuda:12.4.0-base-ubuntu22.04
# FROM runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04
FROM ghcr.io/selkies-project/nvidia-egl-desktop:latest
# runpod/pytorch:2.2.0-py3.10-cuda12.1.1-devel-ubuntu22.04
# FROM runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Needed to share GPU
ENV NVIDIA_DRIVER_CAPABILITIES=all
ENV NVIDIA_VISIBLE_DEVICES=all

# RUN apt-get update \
#     && apt-get install -y \
#     # wget \
#     # gnupg \
#     python3 \
#     python3-pip
#     # libxext6 \
#     # libvulkan1 \
#     # libvulkan-dev \
#     # vulkan-tools

# RUN apt-get install -y python3.12-venv
# COPY nvidia_icd.json /etc/vulkan/icd.d

# RUN apt-get update && apt-get install -y \
#     wget \
#     gnupg \
#     python3 \
#     python3-pip \
#     vulkan-tools \
#     libgl1-mesa-dev \
#     xvfb \
#     libxi-dev \
#     libxcursor-dev \
#     libxdamage-dev \
#     libxrandr-dev \
#     libxcomposite-dev \
#     libxext-dev \
#     libxfixes-dev \
#     libxrender-dev \
#     libgles2-mesa-dev \
#     libegl1-mesa-dev \
#     libgbm-dev \
#     libglu1-mesa \
#     libxi6 \
#     libxrender1 \
#     libxrandr2 \
#     libx11-xcb1 \
#     libxcb-dri3-0 \
#     libxshmfence1 \
#     mesa-utils \
#     libvulkan1 \
#     libegl1-mesa \
#     libopengl0 \
#     libvulkan1 \
#     libnvidia-gl-525 \
#     mesa-vulkan-drivers

# Download and install NVIDIA driver
# RUN DRIVER_URL="https://us.download.nvidia.com/tesla/535.104.12/NVIDIA-Linux-x86_64-535.104.12.run" && \
#     DRIVER_NAME="NVIDIA-Linux-driver.run" && \
#     wget -O "$DRIVER_NAME" "$DRIVER_URL" && \
#     sh "$DRIVER_NAME" --disable-nouveau --silent && \
#     rm "$DRIVER_NAME"

# Create and activate virtual environment
# RUN python3 -m venv /opt/venv
# ENV PATH="/opt/venv/bin:$PATH"

# # Install Playwright and browsers
# RUN pip3 install playwright
# RUN playwright install-deps
# RUN playwright install chrome

# # Install Python dependencies
# COPY requirements.txt /app/requirements.txt
# RUN pip3 install --no-cache-dir -r /app/requirements.txt

# Install Playwright and browsers
RUN pip3 install playwright --break-system-packages
RUN playwright install-deps
# RUN playwright install chrome

USER root
RUN apt-get install -y python3.12-venv
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
# Install Python dependencies
COPY requirements.txt /app/requirements.txt
RUN pip3 install --no-cache-dir -r /app/requirements.txt

# Set up the working directory
WORKDIR /app

# Copy the application code
COPY . /app

# Expose the port your application will run on
EXPOSE 8000

# Command to run the application
CMD ["python3", "main.py"]