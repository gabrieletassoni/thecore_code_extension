Rails.application.configure do
    config.after_initialize do
        # For example, it can be used to load a root action defined in lib, for example:
        # require 'root_actions/tcp_debug'
    end
end
