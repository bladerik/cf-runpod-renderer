FROM ubuntu:22.04 AS vulkan-sample-dev

ARG DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y gcc g++ make cmake libvulkan-dev libglm-dev curl unzip && apt-get clean

RUN useradd luser
USER luser
WORKDIR /home/luser
RUN curl -L -o master.zip https://github.com/SaschaWillems/Vulkan/archive/refs/heads/master.zip && unzip master.zip && rm master.zip
RUN cmake -DUSE_HEADLESS=ON Vulkan-master && \
    make renderheadless

FROM ubuntu:22.04 AS vulkan-sample-run

ARG DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y vulkan-tools && apt-get clean

ENV VK_ICD_FILENAMES=/usr/share/glvnd/egl_vendor.d/10_nvidia.json 
ENV NVIDIA_DRIVER_CAPABILITIES=graphics

RUN useradd luser
COPY --chown=luser:luser --from=vulkan-sample-dev /home/luser/bin/renderheadless /home/luser/bin/renderheadless
COPY --chown=luser:luser --from=vulkan-sample-dev /home/luser/Vulkan-master/shaders/glsl/renderheadless/ /home/luser/Vulkan-master/shaders/glsl/renderheadless/

# Install Playwright and browsers
RUN pip3 install playwright
RUN playwright install-deps
RUN playwright install chrome

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

# reset entrypoint
ENTRYPOINT ["/bin/bash", "-c"]

# Command to run the application
CMD ["python3", "main.py"]