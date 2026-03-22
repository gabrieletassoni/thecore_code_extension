module Abilities
    class {{className}}
        include CanCan::Ability
        def initialize user
            if user.present?
                # Users' abilities
                if user.admin?
                    # Admins' abilities
                end
            end
        end
    end
end
