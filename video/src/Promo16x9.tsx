import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
} from 'remotion';
import {Background} from './components/Background';
import {Logo} from './components/Logo';
import {Headline} from './components/Headline';
import {Cta} from './components/Cta';
import {palette} from './styles';

const HEADLINE = 'Organize, inspect, and control your AI skills in one place.';

export const Promo16x9: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();

  const introScale = spring({
    frame,
    fps,
    from: 0.96,
    to: 1,
    config: {damping: 18, stiffness: 120},
  });
  const introOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const screenshotProgress = interpolate(frame, [60, 300], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const screenshotScale = 1 + screenshotProgress * 0.04;
  const screenshotX = -18 * screenshotProgress;

  const headlineOpacity = interpolate(frame, [70, 95], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const headlineY = interpolate(frame, [70, 95], [12, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const ctaOpacity = interpolate(frame, [310, 335], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ctaY = interpolate(frame, [310, 335], [12, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const musicVolume = interpolate(
    frame,
    [0, 20, durationInFrames - 30, durationInFrames - 1],
    [0, 0.18, 0.18, 0],
    {extrapolateRight: 'clamp'}
  );

  return (
    <AbsoluteFill style={{backgroundColor: palette.bg}}>
      <Background />
      <Audio src={staticFile('assets/Ambient Technology Music.mp3')} volume={musicVolume} />

      {frame < 60 && (
        <AbsoluteFill
          style={{
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              transform: `scale(${introScale})`,
              opacity: introOpacity,
            }}
          >
            <Logo size={140} />
          </div>
        </AbsoluteFill>
      )}

      {frame >= 60 && (
        <>
          <AbsoluteFill
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 120px',
            }}
          >
            <div
              style={{
                transform: `translateX(${screenshotX}px) scale(${screenshotScale})`,
                borderRadius: 24,
                overflow: 'hidden',
                boxShadow: '0 30px 60px rgba(0,0,0,0.45)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <Img
                src={staticFile('assets/screenshot.png')}
                style={{
                  width: 1200,
                  height: 'auto',
                  display: 'block',
                }}
              />
            </div>
          </AbsoluteFill>

          <AbsoluteFill
            style={{
              padding: '0 140px',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                maxWidth: 720,
                transform: `translateY(${headlineY}px)`,
                opacity: headlineOpacity,
              }}
            >
              <Headline text={HEADLINE} maxWidth={720} fontSize={46} />
            </div>
          </AbsoluteFill>
        </>
      )}

      {frame >= 300 && (
        <AbsoluteFill
          style={{
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              transform: `translateY(${ctaY}px)`,
              opacity: ctaOpacity,
            }}
          >
            <Cta text="github.com/princeniu/Skills-Manager" fontSize={22} />
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
