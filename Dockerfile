
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
        libvulkan-dev \
        python3 \
        python3-pip \
        dumb-init \
        mesa-vulkan-drivers \
        vulkan-tools \
        xvfb && \
    rm -rf /var/lib/apt/lists/*

# RUN apt-get update && apt-get -y --no-install-recommends install ca-certificates tzdata libcanberra-gtk-module libexif12 pulseaudio attr fonts-dejavu-core fonts-freefont-ttf fonts-guru-extra fonts-kacst fonts-kacst-one fonts-khmeros-core fonts-lao fonts-liberation fonts-lklug-sinhala fonts-lohit-guru fonts-nanum fonts-opensymbol fonts-sil-abyssinica fonts-sil-padauk fonts-symbola fonts-takao-pgothic fonts-tibetan-machine fonts-tlwg-garuda-ttf fonts-tlwg-kinnari-ttf fonts-tlwg-laksaman-ttf fonts-tlwg-loma-ttf fonts-tlwg-mono-ttf fonts-tlwg-norasi-ttf fonts-tlwg-purisa-ttf fonts-tlwg-sawasdee-ttf fonts-tlwg-typewriter-ttf fonts-tlwg-typist-ttf fonts-tlwg-typo-ttf fonts-tlwg-umpush-ttf fonts-tlwg-waree-ttf ttf-bitstream-vera ttf-dejavu-core ttf-ubuntu-font-family fonts-arphic-ukai fonts-arphic-uming fonts-ipafont-mincho fonts-ipafont-gothic fonts-unfonts-core && rm -rf -- /var/lib/apt/lists /tmp/*.deb

RUN apt-get update
RUN apt-get install -y software-properties-common libvulkan1
RUN add-apt-repository -y ppa:graphics-drivers/ppa
RUN apt-get install libnvidia-gl-550

RUN pip3 install playwright
RUN playwright install-deps
RUN playwright install chrome firefox
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
ENTRYPOINT ["/usr/bin/dumb-init", "--", "xvfb-run", "--auto-servernum", "--server-args",  "-screen 0 1280x1024x24 -ac"]
# Command to run the application
CMD ["python3", "main.py"]