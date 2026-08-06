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
  media_type: 'before_image' | 'during_image' | 'after_image' | 'qc_image' | 'video';
  file_path: string;
  original_name?: string;
  file_size?: number;
  rotation?: number;
  uploaded_at: string;
}

export default function JobCardMediaSection({ jobCardId, jobType, readOnly = false }: JobCardMediaSectionProps) {
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [activeOverlay, setActiveOverlay] = useState<string | null>(null);
  const [activeOverlayRotation, setActiveOverlayRotation] = useState<number>(0);

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

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, mediaType: MediaItem['media_type']) => {
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

  const handleRotate = async (mediaId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await apiClient.post(`${apiPath}/${jobCardId}/media/${mediaId}/rotate`);
      if (res.data && res.data.success) {
        const newRot = res.data.data.rotation;
        setMediaList(prev => prev.map(item => item.id === mediaId ? { ...item, rotation: newRot } : item));
        toast.success('Photo rotated!');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error?.message || 'Failed to rotate photo');
    }
  };

  const beforePhotos = mediaList.filter(item => item.media_type === 'before_image');
  const duringPhotos = mediaList.filter(item => item.media_type === 'during_image');
  const afterPhotos = mediaList.filter(item => item.media_type === 'after_image');
  const qcPhotos = mediaList.filter(item => item.media_type === 'qc_image');
  const videos = mediaList.filter(item => item.media_type === 'video');

  const backendBaseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:4000'
    : window.location.origin;

  const renderSlot = (mediaType: MediaItem['media_type'], label: string, icon: string, accept: string) => {
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

  const renderSection = (photos: MediaItem[], mediaType: MediaItem['media_type'], label: string, colorClass: string, icon: string) => {
    return (
      <div className="glass-panel p-5 rounded-2xl border border-white/5 bg-[#0c0c0c]/40 backdrop-blur-2xl">
        <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-2">
          <h3 className={`font-label-caps text-xs text-white tracking-widest uppercase flex items-center gap-2`}>
            <span className={`material-symbols-outlined text-sm ${colorClass}`}>{icon}</span>
            {label}
            <span className={`text-[10px] ${colorClass} bg-white/5 px-2 py-0.5 rounded-full font-bold`}>
              {photos.length}
            </span>
          </h3>
          <span className="text-[9px] text-tertiary/40 font-mono-data">MAX 50MB</span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {photos.map((item) => (
            <div key={item.id} className="relative aspect-video rounded-lg overflow-hidden border border-white/5 group bg-black flex items-center justify-center">
              <img
                src={`${backendBaseUrl}${item.file_path}`}
                alt={label}
                onClick={() => {
                  setActiveOverlay(`${backendBaseUrl}${item.file_path}`);
                  setActiveOverlayRotation(item.rotation || 0);
                }}
                style={{ transform: `rotate(${item.rotation || 0}deg)` }}
                className="max-w-full max-h-full object-contain opacity-70 hover:opacity-100 hover:scale-105 transition-all duration-300 cursor-pointer"
              />
              <div className="absolute bottom-1 left-1 right-1 flex justify-between opacity-0 group-hover:opacity-100 transition-opacity z-20">
                <button
                  onClick={(e) => handleRotate(item.id, e)}
                  className="bg-black/80 hover:bg-white/20 text-white rounded-lg px-1.5 py-0.5 text-[10px] font-label-caps flex items-center gap-0.5 border border-white/10"
                  title="Rotate 90°"
                >
                  <span className="material-symbols-outlined text-[10px]">rotate_right</span>
                  Rotate
                </button>
                {!readOnly && (
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="bg-black/80 hover:bg-performance-red text-white rounded-lg px-1.5 py-0.5 text-[10px] font-label-caps flex items-center gap-0.5 border border-white/10"
                    title="Delete photo"
                  >
                    <span className="material-symbols-outlined text-[10px]">delete</span>
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
          {!readOnly && renderSlot(mediaType, `+ ADD ${label.split(' ')[0]}`, 'add_photo_alternate', 'image/*')}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* IMAGES GRID: BEFORE & AFTER ONLY */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {renderSection(beforePhotos, 'before_image', 'BEFORE PHOTOS', 'text-performance-red', 'photo_camera')}
        {renderSection(afterPhotos, 'after_image', 'AFTER PHOTOS', 'text-green-400', 'photo_camera')}
      </div>

      {/* LIGHTBOX OVERLAY MODAL */}
      {activeOverlay && (
        <div
          onClick={() => {
            setActiveOverlay(null);
            setActiveOverlayRotation(0);
          }}
          className="fixed inset-0 bg-black/95 z-55 flex items-center justify-center p-4 backdrop-blur-md cursor-zoom-out"
        >
          <img
            src={activeOverlay}
            alt="Full Preview"
            style={{ transform: `rotate(${activeOverlayRotation}deg)` }}
            className="max-w-full max-h-[90vh] object-contain rounded-lg border border-white/10 shadow-2xl transition-transform duration-300"
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveOverlayRotation(prev => (prev + 90) % 360);
              }}
              className="bg-black/60 hover:bg-white/20 text-white rounded-lg px-4 py-2 text-xs font-label-caps border border-white/10 flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">rotate_right</span>
              Rotate Preview
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveOverlay(null);
                setActiveOverlayRotation(0);
              }}
              className="bg-black/60 hover:bg-white/20 text-white rounded-lg px-4 py-2 text-xs font-label-caps border border-white/10"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
