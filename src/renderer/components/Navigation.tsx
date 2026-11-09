import BackButton from './History/BackButton';
import ForwardButton from './History/ForwardButton';
import SettingsButton from './Settings/SettingsButton';

function Navigation(): React.JSX.Element {
  return (
    <nav className="navbar justify-between min-h-12">
      <div>
        <BackButton
          onClick={() => {
            window.renderer.historyAPI.goBack();
          }}
        />
        <ForwardButton />
      </div>
      <div className="flex flex-row gap-4">
        <SettingsButton />
      </div>
    </nav>
  );
}

export default Navigation;
