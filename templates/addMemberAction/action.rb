RailsAdmin::Config::Actions.add_action "{{actionName}}", :base, :member do
    link_icon 'fas fa-file'
    http_methods [:get, :patch]
    # Visible only for the User model
    visible do
        bindings[:object].is_a?(::User)
    end
    # Adding the controller which is needed to compute calls from the ui
    controller do
        proc do
            # if it's a form submission, then update the password
            if !request.xhr? && request.patch?
                flash[:success] = I18n.t("Succesfully clicked on sample action")
                # Redirect to the object
                redirect_to index_path(model_name: @abstract_model.to_param)
            elsif request.xhr? && request.get?
                # Return a json response
                render json: { message: "Hello from {{actionName}}" }, status: :ok
            end
        end
    end
end
