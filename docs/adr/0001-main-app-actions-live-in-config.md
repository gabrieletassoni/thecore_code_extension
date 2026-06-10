# Main App actions live in config/, not lib/

ATOMs keep Root and Member Actions in `lib/{root,member}_actions` because a gem's `lib/` is on the load path and is not managed by the host app's autoloader. In the Main App, Rails 7.1+ generates `config.autoload_lib`, which makes Zeitwerk eager-load `lib/` in production; Thecore action files are imperative scripts (`RailsAdmin::Config::Actions.add_action ...`) that define no matching constants, so placing them in the Main App's `lib/` would crash production boot with `Zeitwerk::NameError`. The extension therefore generates Main App actions into `config/root_actions` and `config/member_actions` — directories Rails never autoloads — and requires them by absolute path (`require Rails.root.join('config', ...).to_s`) from `config/initializers/after_initialize.rb`.

## Considered Options

- `lib/` + patching the `autoload_lib` ignore list in `application.rb`: keeps ATOM/Main App symmetry, but silently edits a file the user owns and breaks if the user reorganises `application.rb`.
- `lib/` unpatched, assuming Rails < 7.1: leaves a production boot crash latent in newer apps.
- `config/` (chosen): never autoloaded on any Rails version and requires no edits to user-owned config, at the cost of an asymmetry with the ATOM layout.
