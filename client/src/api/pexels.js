import axios from "axios";

const API_KEY = import.meta.env.VITE_PEXELS_API_KEY;

export async function searchPexels(query) {
  try {
    const response = await axios.get("https://api.pexels.com/v1/search", {
      params: {
        query,
        per_page: 20,
      },

      headers: {
        Authorization: API_KEY,
      },
    });

    return response.data.photos || [];
  } catch (err) {
    console.error("Pexels image search error:", err);

    return [];
  }
}

export async function searchPexelsVideos(query) {
  try {
    const randomMin = Math.floor(Math.random() * 60) + 5;

    const randomMax =
      Math.floor(Math.random() * (900 - randomMin + 1)) + randomMin;

    const response = await axios.get("https://api.pexels.com/videos/search", {
      params: {
        query,
        per_page: 100,
        min_duration: randomMin,
        max_duration: randomMax,
      },

      headers: {
        Authorization: API_KEY,
      },

      timeout: 1000 * 60,
    });

    const shuffled = [...(response.data.videos || [])].sort(
      () => Math.random() - 0.5,
    );

    return shuffled
      .map((video) => {
        const files = (video.video_files || [])
          .filter(
            (f) =>
              f.file_type === "video/mp4" && f.link && (f.width || 0) >= 480,
          )
          .sort((a, b) => {
            const aScore = Math.abs((a.width || 0) - 1280);

            const bScore = Math.abs((b.width || 0) - 1280);

            return aScore - bScore;
          });

        const bestFile = files[0];

        return {
          ...video,

          _bestUrl: bestFile?.link || "",

          _quality: bestFile?.quality || "",

          _width: bestFile?.width || 0,

          _height: bestFile?.height || 0,

          _duration: video.duration || 0,
        };
      })

      .filter((v) => v._bestUrl && v._duration >= 5)

      .sort((a, b) => b._duration - a._duration);
  } catch (err) {
    console.error("Pexels video search error:", err);

    return [];
  }
}
