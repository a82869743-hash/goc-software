import React, { useEffect, useState } from 'react';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';

interface JobCardMediaSectionProps {
  jobCardId: number;
  jobType: 'regular' | 'quick';
  readOnly?: boolean;
}

interface MediaItem {
  id: number;
  job_card_id: number;
  job_type: 'regular' | 'quick';
  media_type: 'before_image' | 'after_image' | 'video';
  file_path: string;
  original_name?: string;
  file_size?: number;
  uploaded_at: string;
}

export default function JobCardMediaSection({ jobCardId, jobType, readOnly = false }: JobCardMediaSectionProps) {
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [activeOverlay, setActiveOverlay] = useState<string | null>(null);

  const apiPath = jobType === 'regular' ? '/jobs' : '/quick-job-cards';

  const fetchMedia = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`${apiPath}/${jobCardId}/media`);
      if (res.data && res.data.success) {
        setMediaList(res.data.data);
      }
    } catch (e: any) {
      console.error(e);
      toast.error('Failed to load media items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (jobCardId) {
      fetchMedia();
    }
  }, [jobCardId, jobType]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, mediaType: 'before_image' | 'after_image' | 'video') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      toast.error('File exceeds max size limit of 50MB');
      return;
    }

    try {
      setUploadingType(mediaType);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('media_type', mediaType);

      const res = await apiClient.post(`${apiPath}/${jobCardId}/media`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (res.data && res.data.success) {
        toast.success('Media uploaded successfully!');
        fetchMedia();
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error?.message || 'Media upload failed');
    } finally {
      setUploadingType(null);
      // reset file input
      e.target.value = '';
    }
  };

  const handleDelete = async (mediaId: number) => {
    if (!window.confirm('Are you sure you want to delete this media item?')) return;

    try {
      const res = await apiClient.delete(`${apiPath}/${jobCardId}/media/${mediaId}`);
      if (res.data && res.data.success) {
        toast.success('Media deleted successfully!');
        setMediaList(prev => prev.filter(item => item.id !== mediaId));
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error?.message || 'Failed to delete media');
    }
  };

  const beforePhotos = mediaList.filter(item => item.media_type === 'before_image');
  const afterPhotos = mediaList.filter(item => item.media_type === 'after_image');
  const videos = mediaList.filter(item => item.media_type === 'video');

  const backendBaseUrl = 'http://localhost:4000';

  const renderSlot = (mediaType: 'before_image' | 'after_image' | 'video', label: string, icon: string, accept: string) => {
    const isUploading = uploadingType === mediaType;
    return (
      <label className="flex flex-col items-center justify-center border border-dashed border-white/10 hover:border-performance-red/40 hover:bg-performance-red/[0.02] transition-all cursor-pointer rounded-xl h-24 w-full select-none text-center">
        {isUploading ? (
          <>
            <span className="material-symbols-outlined text-performance-red animate-spin text-2xl mb-1">sync</span>
            <span className="font-label-caps text-[9px] text-performance-red uppercase tracking-wider font-bold">UPLOADING...</span>
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-on-surface-variant/60 hover:text-performance-red text-2xl mb-1">{icon}</span>
            <span className="font-label-caps text-[9px] text-on-surface-variant/80 uppercase tracking-widest font-bold">{label}</span>
          </>
        )}
        <input
          type="file"
          accept={accept}
          disabled={readOnly || isUploading}
          onChange={(e) => handleUpload(e, mediaType)}
          className="hidden"
        />
      </label>
    );
  };

  return (
    <div className="space-y-6">
      {/* IMAGES GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* BEFORE IMAGES */}
        <div className="glass-panel p-5 rounded-2xl border border-white/5 bg-[#0c0c0c]/40 backdrop-blur-2xl">
          <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-2">
            <h3 className="font-label-caps text-xs text-white tracking-widest uppercase flex items-center gap-2">
              <span className="material-symbols-outlined text-sm text-performance-red">photo_camera</span>
              BEFORE PHOTOS
              <span className="text-[10px] text-performance-red bg-performance-red/10 px-2 py-0.5 rounded-full font-bold">
                {beforePhotos.length}
              </span>
            </h3>
            <span className="text-[9px] text-tertiary/40 font-mono-data">MAX 50MB</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {beforePhotos.map((item) => (
              <div key={item.id} className="relative aspect-video rounded-lg overflow-hidden border border-white/5 group bg-black">
                <img
                  src={`${backendBaseUrl}${item.file_path}`}
                  alt="Before"
                  onClick={() => setActiveOverlay(`${backendBaseUrl}${item.file_path}`)}
                  className="w-full h-full object-cover opacity-70 hover:opacity-100 hover:scale-105 transition-all duration-300 cursor-pointer"
                />
                {!readOnly && (
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="absolute top-1 right-1 bg-black/60 hover:bg-performance-red/90 text-white rounded-full p-1 transition-colors z-20 flex items-center justify-center border border-white/10"
                    title="Delete photo"
                  >
                    <span className="material-symbols-outlined text-[14px]">close</span>
                  </button>
                )}
              </div>
            ))}
            {!readOnly && renderSlot('before_image', '+ ADD BEFORE', 'add_photo_alternate', 'image/*')}
          </div>
        </div>

        {/* AFTER IMAGES */}
        <div className="glass-panel p-5 rounded-2xl border border-white/5 bg-[#0c0c0c]/40 backdrop-blur-2xl">
          <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-2">
            <h3 className="font-label-caps text-xs text-white tracking-widest uppercase flex items-center gap-2">
              <span className="material-symbols-outlined text-sm text-green-400">photo_camera</span>
              AFTER PHOTOS
              <span className="text-[10px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full font-bold">
                {afterPhotos.length}
              </span>
            </h3>
            <span className="text-[9px] text-tertiary/40 font-mono-data">MAX 50MB</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {afterPhotos.map((item) => (
              <div key={item.id} className="relative aspect-video rounded-lg overflow-hidden border border-white/5 group bg-black">
                <img
                  src={`${backendBaseUrl}${item.file_path}`}
                  alt="After"
                  onClick={() => setActiveOverlay(`${backendBaseUrl}${item.file_path}`)}
                  className="w-full h-full object-cover opacity-70 hover:opacity-100 hover:scale-105 transition-all duration-300 cursor-pointer"
                />
                {!readOnly && (
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="absolute top-1 right-1 bg-black/60 hover:bg-performance-red/90 text-white rounded-full p-1 transition-colors z-20 flex items-center justify-center border border-white/10"
                    title="Delete photo"
                  >
                    <span className="material-symbols-outlined text-[14px]">close</span>
                  </button>
                )}
              </div>
            ))}
            {!readOnly && renderSlot('after_image', '+ ADD AFTER', 'add_photo_alternate', 'image/*')}
          </div>
        </div>
      </div>

      {/* VIDEOS BLOCK */}
      <div className="glass-panel p-5 rounded-2xl border border-white/5 bg-[#0c0c0c]/40 backdrop-blur-2xl">
        <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-2">
          <h3 className="font-label-caps text-xs text-white tracking-widest uppercase flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-blue-400">videocam</span>
            VIDEOS
            <span className="text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full font-bold">
              {videos.length}
            </span>
          </h3>
          <span className="text-[9px] text-tertiary/40 font-mono-data">MAX 50MB</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {videos.map((item) => (
            <div key={item.id} className="relative rounded-lg overflow-hidden border border-white/5 bg-black p-1 flex flex-col justify-between">
              <video
                src={`${backendBaseUrl}${item.file_path}`}
                controls
                className="w-full aspect-video object-cover rounded-md"
              />
              {!readOnly && (
                <button
                  onClick={() => handleDelete(item.id)}
                  className="absolute top-2 right-2 bg-black/60 hover:bg-performance-red/90 text-white rounded-full p-1.5 transition-colors z-20 flex items-center justify-center border border-white/10"
                  title="Delete video"
                >
                  <span className="material-symbols-outlined text-[14px]">delete</span>
                </button>
              )}
            </div>
          ))}
          {!readOnly && (
            <div className="w-full">
              {renderSlot('video', '+ ADD VIDEO', 'video_call', 'video/*')}
            </div>
          )}
        </div>
      </div>

      {/* LIGHTBOX OVERLAY MODAL */}
      {activeOverlay && (
        <div
          onClick={() => setActiveOverlay(null)}
          className="fixed inset-0 bg-black/95 z-55 flex items-center justify-center p-4 backdrop-blur-md cursor-zoom-out"
        >
          <img
            src={activeOverlay}
            alt="Full Preview"
            className="max-w-full max-h-[90vh] object-contain rounded-lg border border-white/10 shadow-2xl"
          />
          <button
            onClick={() => setActiveOverlay(null)}
            className="absolute top-4 right-4 bg-white/10 hover:bg-performance-red text-white rounded-full p-2.5 transition-colors border border-white/10"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      )}
    </div>
  );
}
