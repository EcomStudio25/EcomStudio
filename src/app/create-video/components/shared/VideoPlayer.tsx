'use client';

interface VideoPlayerProps {
  videoUrl: string;
  onClose?: () => void;
}

export default function VideoPlayer({ videoUrl, onClose }: VideoPlayerProps) {
  return (
    <div className="video-player">
      <h2>Your Video is Ready!</h2>
      <video controls src={videoUrl} />
      <div className="video-actions">
        <a href={videoUrl} className="download-btn" download>
          DOWNLOAD
        </a>
      </div>

      <style jsx>{`
        .video-player {
          margin-top: 30px;
          padding: 30px;
          background: #252525;
          border-radius: 15px;
          text-align: center;
        }

        .video-player h2 {
          text-align: center;
          margin-bottom: 25px;
          color: #00b00a;
          font-size: 28px;
        }

        .video-player video {
          width: 40%;
          max-width: 800px;
          margin: 0 auto;
          display: block;
          border-radius: 12px;
          background: #000;
        }

        .video-actions {
          text-align: center;
          margin-top: 25px;
        }

        .download-btn {
          background: #00b00a;
          padding: 18px 50px;
          font-size: 18px;
          font-weight: 600;
          text-decoration: none;
          display: inline-block;
          color: white;
          border-radius: 12px;
          transition: all 0.3s;
          border: none;
          cursor: pointer;
        }

        .download-btn:hover {
          background: #009008;
          transform: translateY(-2px);
        }
      `}</style>
    </div>
  );
}
