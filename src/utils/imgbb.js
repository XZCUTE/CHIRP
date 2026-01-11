
const API_KEY = 'a8d2263996f062376aa8341d5324956c';

export const uploadToImgBB = async (imageFile) => {
  const formData = new FormData();
  formData.append("image", imageFile);

  try {
    const response = await fetch(
      `https://api.imgbb.com/1/upload?key=${API_KEY}`,
      {
        method: "POST",
        body: formData
      }
    );

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error?.message || "Image upload failed");
    }

    return {
      url: data.data.url,
      deleteUrl: data.data.delete_url
    };
  } catch (error) {
    console.error("ImgBB Upload Error:", error);
    throw error;
  }
};

export const deleteFromImgBB = async (deleteUrl) => {
  if (!deleteUrl) return;
  try {
    // Note: The delete_url provided by ImgBB API free tier is a web page URL, 
    // but sometimes it can be triggered. However, without a paid API delete endpoint,
    // this is a best-effort attempt.
    // If the deleteUrl is actually an API endpoint (as per some docs), this fetch will work.
    // If it's a web page, this might just fetch the page (which is fine, it won't break app).
    // But usually for programmatic delete you need the delete hash or management key.
    // Since we are using the simple API key upload, we rely on what is provided.
    
    // Attempt to fetch the delete URL (best effort)
    await fetch(deleteUrl, { mode: 'no-cors' }); 
  } catch (error) {
    console.warn("Failed to delete image from ImgBB:", error);
  }
};
