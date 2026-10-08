import home from '../../assets/png/retina/ui/controls/icon_home.png';
import close from '../../assets/png/retina/ui/controls/icon_close.png';
import pause from '../../assets/png/retina/ui/controls/icon_pause.png';
import restart from '../../assets/png/retina/ui/controls/icon_restart.png';
import plus from '../../assets/png/retina/ui/controls/icon_plus.png';
import minus from '../../assets/png/retina/ui/controls/icon_minus.png';

const icons = { home, close, pause, restart, plus, minus };
export function AssetIcon({ name }: { name: keyof typeof icons }) {
  return <img className="asset-icon" src={icons[name]} alt="" />;
}
