FROM nvidia/cuda:12.2.0-base-ubuntu22.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Install system dependencies and NVIDIA/CUDA related packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    gnupg \
    python3 \
    python3-pip \
    build-essential \
    curl \
    vulkan-tools \
    && curl -fsSL https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/cuda-keyring_1.0-1_all.deb -o cuda-keyring.deb \
    && dpkg -i cuda-keyring.deb \
    && apt-get update \
    && apt-get install -y --no-install-recommends cuda-drivers \
    && rm -rf /var/lib/apt/lists/* \
    && rm cuda-keyring.deb

# Verify Vulkan installation
RUN vulkaninfo && sleep 5

# Install Playwright and browsers
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

# Command to run the application
CMD ["python3", "main.py"]