'use client';

import Link from 'next/link';

interface VideoProcessingProps {
  timer: string;
}

export default function VideoProcessing({ timer }: VideoProcessingProps) {
  return (
    <div className="video-processing">
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <img src="/Video_Process.gif" alt="Processing" />
        <div className="timer-overlay">{timer}</div>
      </div>
      <div className="processing-text-new">
        <div className="processing-line-1">YOUR VIDEO IS BEING PROCESSED.</div>
        <div className="processing-line-2">
          You may leave the page. This process will not be interrupted.
        </div>
        <div className="processing-line-3">
          The entire video will appear on the{' '}
          <Link href="/video-assets">Video Assets</Link> page.
        </div>
        <div className="processing-line-4">
          (This process will take approximately 2-3 minutes.)
        </div>
      </div>

      <style jsx>{`
        .video-processing {
          text-align: center;
          padding: 60px 20px;
        }

        .video-processing img {
          width: 500px;
          height: 400px;
          margin: 0 auto 30px;
        }

        .timer-overlay {
          position: absolute;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.8);
          color: #fff;
          padding: 8px 20px;
          border-radius: 8px;
          font-size: 24px;
          font-weight: bold;
        }

        .processing-text-new {
          text-align: center;
          line-height: 2;
        }

        .processing-line-1 {
          font-size: 18px;
          color: #95ff04;
          font-weight: 600;
        }

        .processing-line-2 {
          font-size: 18px;
          color: #fff;
        }

        .processing-line-3 {
          font-size: 18px;
          color: #fff;
        }

        .processing-line-3 :global(a) {
          color: #fff;
          text-decoration: underline;
          font-weight: bold;
        }

        .processing-line-4 {
          font-size: 18px;
          color: #00c6ff;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
