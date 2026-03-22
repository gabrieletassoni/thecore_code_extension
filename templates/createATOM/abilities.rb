module Abilities
    class {{className}}
        include CanCan::Ability
        def initialize user
            if user.present?
                # Users' abilities
                # Example: can :read, ModelName
                # Example: can [:read, :create], ModelName
                if user.admin?
                    # Admins' abilities
                    # Example: can :manage, :all
                end
            end
        end
    end
end
