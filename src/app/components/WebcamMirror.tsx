"use client";

import { useRef, useEffect, useState } from "react";

const WorkingWebcamWarp = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvas1Ref = useRef<HTMLCanvasElement>(null);
  const canvas2Ref = useRef<HTMLCanvasElement>(null);
  const canvas3Ref = useRef<HTMLCanvasElement>(null);
  const outputCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isWarping, setIsWarping] = useState(true);

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 320 },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef
            .current!.play()
            .then(() => {
              console.log("Video playback started");
              startWarpingLoop();
            })
            .catch((err) => console.error("Error playing video:", err));
        };
      }
    } catch (err) {
      console.error("Error accessing webcam:", err);
      alert("Could not access webcam. Check permissions and try again.");
    }
  };

  const stopWebcam = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const adjustContrast = (imageData: ImageData, contrast: number) => {
    const data = imageData.data;
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128)); // Red
      data[i + 1] = Math.min(
        255,
        Math.max(0, factor * (data[i + 1] - 128) + 128)
      ); // Green
      data[i + 2] = Math.min(
        255,
        Math.max(0, factor * (data[i + 2] - 128) + 128)
      ); // Blue
      // Alpha remains unchanged
    }

    return imageData;
  };

  const adjustSaturation = (imageData: ImageData, saturation: number) => {
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b; // Luminance for grayscale

      data[i] = Math.round(gray * (1 - saturation) + r * saturation); // Red
      data[i + 1] = Math.round(gray * (1 - saturation) + g * saturation); // Green
      data[i + 2] = Math.round(gray * (1 - saturation) + b * saturation); // Blue
      // Alpha remains unchanged
    }

    return imageData;
  };

  const applySquareSplitTransformation = (
    sourceCanvas: HTMLCanvasElement,
    targetCanvas: HTMLCanvasElement
  ) => {
    const sourceCtx = sourceCanvas.getContext("2d");
    const targetCtx = targetCanvas.getContext("2d");

    if (!sourceCtx || !targetCtx) return;

    const width = 640; // Doubled
    const height = 320; // Doubled
    const squareSize = 320; // Doubled

    targetCtx.clearRect(0, 0, width, height);

    const sourceImageData = sourceCtx.getImageData(0, 0, width, height);
    const targetImageData = targetCtx.createImageData(width, height);

    // Create square version (stretch 640x320 to 320x320)
    const squareImageData = new Uint8ClampedArray(squareSize * squareSize * 4);

    for (let y = 0; y < squareSize; y++) {
      for (let x = 0; x < squareSize; x++) {
        const sourceX = Math.floor((x / squareSize) * width);
        const sourceY = Math.floor((y / squareSize) * height);

        const sourceIndex = (sourceY * width + sourceX) * 4;
        const squareIndex = (y * squareSize + x) * 4;

        squareImageData[squareIndex] = sourceImageData.data[sourceIndex];
        squareImageData[squareIndex + 1] =
          sourceImageData.data[sourceIndex + 1];
        squareImageData[squareIndex + 2] =
          sourceImageData.data[sourceIndex + 2];
        squareImageData[squareIndex + 3] =
          sourceImageData.data[sourceIndex + 3];
      }
    }

    // Scaled parameters for higher resolution
    const middleColumnsCount = 80; // Doubled from 40
    const startMiddleCol = (squareSize - middleColumnsCount) / 2;
    const blendWidth = 20; // Doubled from 10

    const getSquarePixel = (squareX: number, squareY: number) => {
      const squareIndex = (squareY * squareSize + squareX) * 4;
      return [
        squareImageData[squareIndex],
        squareImageData[squareIndex + 1],
        squareImageData[squareIndex + 2],
        squareImageData[squareIndex + 3],
      ];
    };

    const blendPixels = (pixel1: number[], pixel2: number[], ratio: number) => {
      return [
        Math.round(pixel1[0] * (1 - ratio) + pixel2[0] * ratio),
        Math.round(pixel1[1] * (1 - ratio) + pixel2[1] * ratio),
        Math.round(pixel1[2] * (1 - ratio) + pixel2[2] * ratio),
        Math.round(pixel1[3] * (1 - ratio) + pixel2[3] * ratio),
      ];
    };

    // Build the final 640x320 image with scaled boundaries
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const targetIndex = (y * width + x) * 4;
        const squareY = Math.floor((y / height) * squareSize);

        let finalPixel;

        if (x < 120 - blendWidth) {
          // Scaled from 60
          // Pure left section
          const squareX = Math.floor((x / 120) * (squareSize / 2));
          finalPixel = getSquarePixel(squareX, squareY);
        } else if (x < 120 + blendWidth) {
          // Left-to-middle blend zone
          const leftSquareX = Math.floor((x / 120) * (squareSize / 2));
          const middlePosition =
            (x - (120 - blendWidth)) / (400 + 2 * blendWidth);
          const middleSquareX = Math.floor(
            startMiddleCol + middlePosition * (middleColumnsCount - 1)
          );

          const leftPixel = getSquarePixel(leftSquareX, squareY);
          const middlePixel = getSquarePixel(middleSquareX, squareY);

          const blendRatio = (x - (120 - blendWidth)) / (2 * blendWidth);
          finalPixel = blendPixels(leftPixel, middlePixel, blendRatio);
        } else if (x < 520 - blendWidth) {
          // Scaled from 260
          // Pure middle section
          const middlePosition = (x - 120) / 400; // Scaled from (x-60)/200
          const squareX = Math.floor(
            startMiddleCol + middlePosition * (middleColumnsCount - 1)
          );
          finalPixel = getSquarePixel(squareX, squareY);
        } else if (x < 520 + blendWidth) {
          // Middle-to-right blend zone
          const middlePosition = (x - 120) / 400;
          const middleSquareX = Math.floor(
            startMiddleCol + middlePosition * (middleColumnsCount - 1)
          );
          const rightSquareX =
            Math.floor(((x - 520) / 120) * (squareSize / 2)) + squareSize / 2;

          const middlePixel = getSquarePixel(middleSquareX, squareY);
          const rightPixel = getSquarePixel(rightSquareX, squareY);

          const blendRatio = (x - (520 - blendWidth)) / (2 * blendWidth);
          finalPixel = blendPixels(middlePixel, rightPixel, blendRatio);
        } else {
          // Pure right section
          const squareX =
            Math.floor(((x - 520) / 120) * (squareSize / 2)) + squareSize / 2;
          finalPixel = getSquarePixel(squareX, squareY);
        }

        targetImageData.data[targetIndex] = finalPixel[0];
        targetImageData.data[targetIndex + 1] = finalPixel[1];
        targetImageData.data[targetIndex + 2] = finalPixel[2];
        targetImageData.data[targetIndex + 3] = finalPixel[3];
      }
    }

    // Apply contrast adjustment
    const contrastedImageData = adjustContrast(targetImageData, 40); // Adjust the value (e.g., 0-100) for more/less contrast

    // Apply saturation reduction
    const desaturatedImageData = adjustSaturation(contrastedImageData, 0.7); // 0.6 means 60% saturation (reduce from full color)

    targetCtx.putImageData(desaturatedImageData, 0, 0);
  };

  const applyBulgeWarponleft = (
    sourceCanvas: HTMLCanvasElement,
    targetCanvas: HTMLCanvasElement
  ) => {
    const sourceCtx = sourceCanvas.getContext("2d");
    const targetCtx = targetCanvas.getContext("2d");

    const width = sourceCanvas.width;
    const height = sourceCanvas.height;
    const centerX = (2 * width) / 4;
    const centerY = height / 2;
    const maxRadius = 320; // Doubled from 160

    if (!sourceCtx || !targetCtx) return;

    targetCtx.clearRect(0, 0, width, height);

    const sourceImageData = sourceCtx.getImageData(0, 0, width, height);
    const targetImageData = targetCtx.createImageData(width, height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < maxRadius) {
          const bulgeAmount = 0.9;
          const effect = (1 - distance / maxRadius) * bulgeAmount;
          const sourceX = Math.round(centerX + dx * (1 - effect));
          const sourceY = Math.round(centerY + dy * (1 - effect));

          if (
            sourceX >= 0 &&
            sourceX < width &&
            sourceY >= 0 &&
            sourceY < height
          ) {
            const targetIndex = (y * width + x) * 4;
            const sourceIndex = (sourceY * width + sourceX) * 4;

            targetImageData.data[targetIndex] =
              sourceImageData.data[sourceIndex];
            targetImageData.data[targetIndex + 1] =
              sourceImageData.data[sourceIndex + 1];
            targetImageData.data[targetIndex + 2] =
              sourceImageData.data[sourceIndex + 2];
            targetImageData.data[targetIndex + 3] =
              sourceImageData.data[sourceIndex + 3];
          }
        } else {
          const targetIndex = (y * width + x) * 4;
          const sourceIndex = (y * width + x) * 4;

          targetImageData.data[targetIndex] = sourceImageData.data[sourceIndex];
          targetImageData.data[targetIndex + 1] =
            sourceImageData.data[sourceIndex + 1];
          targetImageData.data[targetIndex + 2] =
            sourceImageData.data[sourceIndex + 2];
          targetImageData.data[targetIndex + 3] =
            sourceImageData.data[sourceIndex + 3];
        }
      }
    }

    targetCtx.putImageData(targetImageData, 0, 0);
  };

  const applyBulgeWarponright = (
    sourceCanvas: HTMLCanvasElement,
    targetCanvas: HTMLCanvasElement
  ) => {
    const sourceCtx = sourceCanvas.getContext("2d");
    const targetCtx = targetCanvas.getContext("2d");

    const width = sourceCanvas.width;
    const height = sourceCanvas.height;
    const centerX = width / 2;
    const centerY = Math.min(width, height) / 2;
    const maxRadius = 320; // Doubled from 160

    if (!sourceCtx || !targetCtx) return;

    targetCtx.clearRect(0, 0, width, height);

    const sourceImageData = sourceCtx.getImageData(0, 0, width, height);
    const targetImageData = targetCtx.createImageData(width, height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < maxRadius) {
          const bulgeAmount = 0.9;
          const effect = (1 - distance / maxRadius) * bulgeAmount;
          const sourceX = Math.round(centerX + dx * (1 - effect));
          const sourceY = Math.round(centerY + dy * (1 - effect));

          if (
            sourceX >= 0 &&
            sourceX < width &&
            sourceY >= 0 &&
            sourceY < height
          ) {
            const targetIndex = (y * width + x) * 4;
            const sourceIndex = (sourceY * width + sourceX) * 4;

            targetImageData.data[targetIndex] =
              sourceImageData.data[sourceIndex];
            targetImageData.data[targetIndex + 1] =
              sourceImageData.data[sourceIndex + 1];
            targetImageData.data[targetIndex + 2] =
              sourceImageData.data[sourceIndex + 2];
            targetImageData.data[targetIndex + 3] =
              sourceImageData.data[sourceIndex + 3];
          }
        } else {
          const targetIndex = (y * width + x) * 4;
          const sourceIndex = (y * width + x) * 4;

          targetImageData.data[targetIndex] = sourceImageData.data[sourceIndex];
          targetImageData.data[targetIndex + 1] =
            sourceImageData.data[sourceIndex + 1];
          targetImageData.data[targetIndex + 2] =
            sourceImageData.data[sourceIndex + 2];
          targetImageData.data[targetIndex + 3] =
            sourceImageData.data[sourceIndex + 3];
        }
      }
    }

    targetCtx.putImageData(targetImageData, 0, 0);
  };

  const startWarpingLoop = () => {
    const video = videoRef.current;
    const canvas1 = canvas1Ref.current;
    const canvas2 = canvas2Ref.current;
    const canvas3 = canvas3Ref.current;
    const outputCanvas = outputCanvasRef.current;

    if (!video || !canvas1 || !canvas2 || !canvas3 || !outputCanvas) return;

    const ctx = canvas1.getContext("2d");
    if (!ctx) return;

    const renderFrame = () => {
      if (video.readyState >= 2 && isWarping) {
        // Draw current video frame to first canvas
        ctx.drawImage(video, 0, 0, 640, 320); // Higher resolution

        applyBulgeWarponleft(canvas1, canvas2);
        applyBulgeWarponright(canvas2, canvas3);
        applySquareSplitTransformation(canvas3, outputCanvas);
      }

      requestAnimationFrame(renderFrame);
    };

    renderFrame();
  };

  useEffect(() => {
    startWebcam();
    return () => {
      stopWebcam();
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-800">
      <button
        className="relative overflow-hidden rounded-full bg-neutral-600 text-white text-xl cursor-pointer mb-4 shadow-black shadow-2xl smooth-corners-lg"
        style={{
          width: "320px",
          height: "160px",
        }}
        onClick={() => alert("Warped button clicked!")}
      >
        <video ref={videoRef} playsInline muted style={{ display: "none" }} />

        <canvas
          ref={canvas1Ref}
          width={640}
          height={320}
          style={{ display: "none" }}
        />

        <canvas
          ref={canvas2Ref}
          width={640}
          height={320}
          style={{ display: "none" }}
        />

        <canvas
          ref={canvas3Ref}
          width={640}
          height={320}
          style={{ display: "none" }}
        />

        <canvas
          ref={outputCanvasRef}
          width={640}
          height={320}
          className="absolute top-0 left-0 w-full h-full transform scale-x-[-1]"
          style={{ objectFit: "fill" }}
        />

        <div className="z-10 absolute top-2 left-2 rounded-full w-[304px] h-[144px] backdrop-blur-md blur-lg"></div>

        <div
          className="z-10 absolute inset-2 flex items-center justify-center rounded-full text-neutral-300 drop-shadow-sm drop-shadow-black/50"
          style={{
            fontFamily: '"Instrument Serif", serif',
            fontSize: "48px",
            fontWeight: 400,
          }}
        >
          Liquid Mirror
        </div>
      </button>
    </div>
  );
};

export default WorkingWebcamWarp;
