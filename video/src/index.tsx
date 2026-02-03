import {Composition} from 'remotion';
import {Promo16x9} from './Promo16x9';
import {Promo9x16} from './Promo9x16';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Promo16x9"
        component={Promo16x9}
        durationInFrames={450}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="Promo9x16"
        component={Promo9x16}
        durationInFrames={450}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
