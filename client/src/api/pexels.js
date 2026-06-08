import axios from 'axios'

const API_KEY = import.meta.env.VITE_PEXELS_API_KEY

// ─────────────────────────────────────────────
// IMAGE SEARCH
// ─────────────────────────────────────────────
export async function searchPexels(query) {
  try {
    const response = await axios.get(
      'https://api.pexels.com/v1/search',
      {
        params: {
          query,
          per_page: 20,
        },

        headers: {
          Authorization: API_KEY,
        },
      }
    )

    return response.data.photos || []
  } catch (err) {
    console.error(
      'Pexels image search error:',
      err
    )

    return []
  }
}

// ─────────────────────────────────────────────
// VIDEO SEARCH
// ─────────────────────────────────────────────
export async function searchPexelsVideos(query) {
  try {
    // RANDOM VIDEO DURATION RANGE
    // 5 sec → 15 min
    const randomMin =
      Math.floor(Math.random() * 60) + 5

    const randomMax =
      Math.floor(
        Math.random() *
          (900 - randomMin + 1)
      ) + randomMin

    const response = await axios.get(
      'https://api.pexels.com/videos/search',
      {
        params: {
          query,

          // LOAD MANY VIDEOS
          per_page: 100,

          // RANDOM DURATION FILTER
          min_duration: randomMin,
          max_duration: randomMax,
        },

        headers: {
          Authorization: API_KEY,
        },

        timeout: 1000 * 60,
      }
    )

    // RANDOMIZE RESULTS
    const shuffled = [
      ...(response.data.videos || []),
    ].sort(() => Math.random() - 0.5)

    return shuffled
      .map(video => {
        // VALID MP4 FILES ONLY
        const files = (
          video.video_files || []
        )
          .filter(
            f =>
              f.file_type ===
                'video/mp4' &&
              f.link &&
              (f.width || 0) >= 480
          )
          .sort((a, b) => {
            // PREFER 720P / 1080P
            const aScore = Math.abs(
              (a.width || 0) - 1280
            )

            const bScore = Math.abs(
              (b.width || 0) - 1280
            )

            return aScore - bScore
          })

        const bestFile = files[0]

        return {
          ...video,

          // MAIN PLAYABLE VIDEO
          _bestUrl:
            bestFile?.link || '',

          // VIDEO META
          _quality:
            bestFile?.quality || '',

          _width:
            bestFile?.width || 0,

          _height:
            bestFile?.height || 0,

          // DURATION
          _duration:
            video.duration || 0,
        }
      })

      // FILTER INVALID VIDEOS
      .filter(
        v =>
          v._bestUrl &&
          v._duration >= 5
      )

      // SORT LONGER VIDEOS FIRST
      .sort(
        (a, b) =>
          b._duration - a._duration
      )
  } catch (err) {
    console.error(
      'Pexels video search error:',
      err
    )

    return []
  }
}