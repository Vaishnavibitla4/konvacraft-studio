import { useState } from 'react'
import { searchImages } from '../api/unsplash'
import { searchPexels, searchPexelsVideos } from '../api/pexels'
import { useEditorStore } from '../store/editorStore'

function Skeleton() {
  return (
    <div className="grid grid-cols-2 gap-2 p-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl animate-pulse"
          style={{
            height: 80 + (i % 3) * 20,
            background:
              'linear-gradient(90deg,rgba(255,255,255,0.05) 25%,rgba(255,255,255,0.1) 50%,rgba(255,255,255,0.05) 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmerSlide 1.5s infinite',
          }}
        />
      ))}
    </div>
  )
}

export default function ImageSearch({ onSearch, mode }) {
  const [query, setQuery] = useState('')
  const [images, setImages] = useState([])
  const [videos, setVideos] = useState([])
  const [activeTab, setActiveTab] = useState('images')
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const { addShape } = useEditorStore()

  async function handleSearch() {
    if (!query.trim()) return

    setLoading(true)
    setSearched(false)

    try {
      const [unsplashRes, pexelsImgs, pexelsVids] = await Promise.all([
        searchImages(query).catch(() => []),
        searchPexels(query).catch(() => []),
        searchPexelsVideos(query).catch(() => []),
      ])

      // -----------------------------
      // IMAGES
      // -----------------------------
      const mergedImages = [
        ...unsplashRes.map(img => ({
          id: `u-${img.id}`,
          preview: img.urls.small,
          full: img.urls.regular,
          color: img.color,
          credit: img.user?.name,
        })),

        ...pexelsImgs.map(img => ({
          id: `p-${img.id}`,
          preview: img.src.medium,
          full: img.src.large,
          color: img.avg_color,
          credit: img.photographer,
        })),
      ]

      // ✅ Remove duplicate image IDs
      const uniqueImages = Array.from(
        new Map(mergedImages.map(img => [img.id, img])).values()
      )

      setImages(uniqueImages)

      // -----------------------------
      // VIDEOS
      // -----------------------------
      const mergedVideos = pexelsVids
        .map(v => ({
          id: `v-${v.id}`,
          preview: v.image,

          // Best quality video URL
          src: v._bestUrl,

          duration: v.duration,
          width: v._width,
          height: v._height,
          credit: v.user?.name,
        }))
        .filter(v => v.src)

      // ✅ Remove duplicate video IDs
      const uniqueVideos = Array.from(
        new Map(mergedVideos.map(v => [v.id, v])).values()
      )

      setVideos(uniqueVideos)

      setSearched(true)
      setActiveTab('images')

      onSearch?.()
    } catch (err) {
      console.error('Search error:', err)
    } finally {
      setLoading(false)
    }
  }

  function addImage(url) {
    addShape({
      type: 'image',
      src: url,
      x: 80,
      y: 80,
      width: 320,
      height: 220,
      opacity: 1,
    })
  }

  function addVideo(video) {
    const aspect =
      video.height && video.width
        ? video.height / video.width
        : 9 / 16

    const w = 440
    const h = Math.round(w * aspect)

    addShape({
      type: 'video',
      src: video.src,
      x: 80,
      y: 80,
      width: w,
      height: h,
      opacity: 1,
      loop: true,
      muted: true,
      volume: 0,
      playbackRate: 1,
    })
  }

  return (
    <div>
      <style>{`
        @keyframes shimmerSlide {
          0% { background-position: -200% 0 }
          100% { background-position: 200% 0 }
        }

        .media-hover {
          position: relative;
          overflow: hidden;
          border-radius: 10px;
          cursor: pointer;
          transition: transform 0.15s, box-shadow 0.15s;
        }

        .media-hover:hover {
          transform: scale(1.04);
          box-shadow: 0 8px 24px rgba(124,58,237,0.3);
        }

        .media-hover::after {
          content: '+';
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 26px;
          font-weight: 300;
          color: white;
          background: rgba(124,58,237,0.55);
          opacity: 0;
          transition: opacity 0.15s;
          border-radius: 10px;
        }

        .media-hover:hover::after {
          opacity: 1;
        }
      `}</style>

      {/* Search bar */}
      <div className="flex gap-2 mb-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-xs">
            🔍
          </span>

          <input
            type="text"
            placeholder="Photos & videos…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            className="w-full pl-8 pr-3 py-2 text-xs rounded-xl outline-none border border-white/10 focus:border-violet-500/60 text-white placeholder-white/25 transition-all"
            style={{
              background: 'rgba(255,255,255,0.06)',
            }}
          />
        </div>

        <button
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          className="px-3 py-2 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-40 shrink-0"
          style={{
            background:
              'linear-gradient(135deg,#7c3aed,#ec4899)',
          }}
        >
          {loading ? (
            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
          ) : (
            'Go'
          )}
        </button>
      </div>

      {/* Tabs */}
      {searched && !loading && (
        <div className="flex gap-1 mb-2">
          <button
            onClick={() => setActiveTab('images')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all
              ${
                activeTab === 'images'
                  ? 'text-white'
                  : 'text-white/40 hover:text-white/60'
              }`}
            style={
              activeTab === 'images'
                ? {
                    background:
                      'linear-gradient(135deg,#7c3aed,#6d28d9)',
                  }
                : {
                    background: 'rgba(255,255,255,0.06)',
                  }
            }
          >
            🖼 Images ({images.length})
          </button>

          <button
            onClick={() => setActiveTab('videos')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all
              ${
                activeTab === 'videos'
                  ? 'text-white'
                  : 'text-white/40 hover:text-white/60'
              }`}
            style={
              activeTab === 'videos'
                ? {
                    background:
                      'linear-gradient(135deg,#ec4899,#db2777)',
                  }
                : {
                    background: 'rgba(255,255,255,0.06)',
                  }
            }
          >
            🎬 Videos ({videos.length})
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && <Skeleton />}

      {/* Images */}
      {!loading &&
        searched &&
        activeTab === 'images' && (
          <div className="grid grid-cols-2 gap-1.5">
            {images.map((img, index) => (
              <div
                key={`${img.id}-${index}`}
                className="media-hover"
                style={{
                  background: img.color || '#1a1a2e',
                }}
                onClick={() => addImage(img.full)}
              >
                <img
                  src={img.preview}
                  alt=""
                  className="w-full object-cover rounded-[10px]"
                  style={{
                    minHeight: 65,
                    maxHeight: 110,
                  }}
                  loading="lazy"
                />
              </div>
            ))}

            {images.length === 0 && (
              <p className="col-span-2 text-center py-8 text-white/30 text-xs">
                No images found
              </p>
            )}
          </div>
        )}

      {/* Videos */}
      {!loading &&
        searched &&
        activeTab === 'videos' && (
          <div className="grid grid-cols-2 gap-1.5">
            {videos.map((vid, index) => (
              <div
                key={`${vid.id}-${index}`}
                className="media-hover"
                onClick={() => addVideo(vid)}
              >
                <div className="relative">
                  <img
                    src={vid.preview}
                    alt=""
                    loading="lazy"
                    className="w-full object-cover rounded-[10px]"
                    style={{ height: 85 }}
                  />

                  {/* Overlay */}
                  <div className="absolute inset-0 flex items-end justify-between p-1.5 pointer-events-none">
                    <div className="w-6 h-6 rounded-full bg-black/60 flex items-center justify-center">
                      <span className="text-white text-[9px] ml-0.5">
                        ▶
                      </span>
                    </div>

                    {vid.duration != null && (
                      <div className="bg-black/70 text-white text-[9px] font-mono px-1.5 py-0.5 rounded">
                        {Math.floor(vid.duration / 60)}:
                        {String(
                          vid.duration % 60
                        ).padStart(2, '0')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {videos.length === 0 && (
              <p className="col-span-2 text-center py-8 text-white/30 text-xs">
                No videos found
              </p>
            )}
          </div>
        )}
    </div>
  )
}