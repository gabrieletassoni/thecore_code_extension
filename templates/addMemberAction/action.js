var {{actionNameCamelCase}}Cable = null;
// If the {{actionNameCamelCase}}Function is already defined, then don't redefine it and don't attach it to the eventListener
if (typeof {{actionNameCamelCase}}Function !== 'function') {
    function {{actionNameCamelCase}}Function(event) {
        console.log('Hello from {{actionName}}', event);
        // Action Cable WebSocket connection only if {{actionNameCamelCase}}Cable is not already defined and valid
        if (typeof {{actionNameCamelCase}}Cable !== 'object' || {{actionNameCamelCase}}Cable === null) {
            {{actionNameCamelCase}}Cable = App.cable.subscriptions.create("ActivityLogChannel", {
               connected() {
                   console.log("Connected to the channel:", this);
                   this.send({ message: '{{actionName}} Client is connected', topic: "{{actionName}}", namespace: "subscriptions" });
               },
               disconnected() {
                   console.log("{{actionName}} Client Disconnected");
               },
               received(data) {
                   if(data["topic"] == "{{actionName}}") {
                       console.log("{{actionName}}", data);
                       $("#response").html(data["message"])
                   }
               }
           });
        }
        // Send a message to the server
        {{actionNameCamelCase}}Cable.send({ message: '{{actionName}} Client is sending a message', topic: "{{actionName}}", namespace: "subscriptions" });
        // Using plain Javascript, attach to the button with ID {{actionName}}-id a click event listener which sends to the server an xhr get request and alerts the response
        document.getElementById('{{actionName}}-id').addEventListener('click', function() {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', "#{rails_admin.send('{{actionName}}_path')}", true);
            xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
            xhr.onreadystatechange = function() {
                if (xhr.readyState == 4 && xhr.status == 200) {
                    var response = JSON.parse(xhr.responseText);
                    document.getElementById('{{actionName}}-response').innerHTML = response.message;
                }
            }
            xhr.send();
        });
    }
}
// Attach the function to the eventListener
document.addEventListener('turbo:load', {{actionNameCamelCase}}Function)});
