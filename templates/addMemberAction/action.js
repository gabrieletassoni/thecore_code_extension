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
                       document.getElementById('{{actionName}}-response').innerHTML = data["message"];
                   }
               }
           });
        }
        // Send a message to the server
        {{actionNameCamelCase}}Cable.send({ message: '{{actionName}} Client is sending a message', topic: "{{actionName}}", namespace: "subscriptions" });
        // Attach a click event listener to the button which sends an XHR GET request and shows the response.
        // The URL is read from the data-url attribute to avoid ERB interpolation in plain .js files.
        document.getElementById('{{actionName}}-id').addEventListener('click', function() {
            var url = this.dataset.url;
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
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
document.addEventListener('turbo:load', {{actionNameCamelCase}}Function);
