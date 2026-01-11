export const extractColor = (imageSrc) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageSrc;

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      
      // Resize for faster processing
      canvas.width = 50;
      canvas.height = 50;
      
      ctx.drawImage(img, 0, 0, 50, 50);
      
      try {
        const imageData = ctx.getImageData(0, 0, 50, 50).data;
        let r = 0, g = 0, b = 0;
        let count = 0;

        for (let i = 0; i < imageData.length; i += 4) {
          // Skip transparent or very dark/white pixels if needed
          // Simple average for now
          r += imageData[i];
          g += imageData[i + 1];
          b += imageData[i + 2];
          count++;
        }

        r = Math.floor(r / count);
        g = Math.floor(g / count);
        b = Math.floor(b / count);

        // Brighten up the color if it's too dark to be an accent
        // Or maybe we want it as a background tint?
        // Let's just return the hex
        const hex = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
        resolve(hex);
      } catch (e) {
        console.error("Error extracting color", e);
        // Fallback
        resolve("#d2691e"); 
      }
    };

    img.onerror = (err) => {
      console.error("Image load error for color extraction", err);
      resolve("#d2691e");
    };
  });
};

export const getRandomColor = () => {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
};

// Function to generate a random vibrant color (not too dark, not too pale)
export const getRandomVibrantColor = () => {
  const h = Math.floor(Math.random() * 360);
  const s = Math.floor(Math.random() * 40) + 60; // 60-100%
  const l = Math.floor(Math.random() * 40) + 40; // 40-80%
  return `hsl(${h}, ${s}%, ${l}%)`;
};
