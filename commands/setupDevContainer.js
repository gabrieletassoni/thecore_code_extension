// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { workspaceExixtence } = require('../libs/check');

// The code you place here will be executed every time your command is executed
/**
 * Sets up a Thecore 3 Devcontainer.
 */
function perform() {
    // Display a message box to the user
    vscode.window.showInformationMessage('Setting up a Thecore 3 Devcontainer.');

    // Switches the VS Code Window to Output panel like the user would do manually to the specific output channel called Thecore, if it does not exist, the channel will be created
    const outputChannel = vscode.window.createOutputChannel('Thecore: Setup Devcontainer');
    outputChannel.show();
    outputChannel.appendLine('Setting up a Thecore 3 Devcontainer.');

    // Call the checkWorkspace function from the checks.js file, if it's not ok, return
    if (!workspaceExixtence()) { return; }

    // Checking if the .devcontainer directory is present in the root of the vs code workspace and creating it if not
    const devcontainerDir = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, '.devcontainer');
    if (!fs.existsSync(devcontainerDir)) {
        fs.mkdirSync(devcontainerDir);
        outputChannel.appendLine('.devcontainer directory not exists, creating it right now.');

        // Asking the user for the name of the devcontainer
        vscode.window.showInputBox({
            placeHolder: 'Enter the name of the devcontainer, i.e. Thecore BE',
            value: 'thecore-devcontainer'
        }).then((devcontainerName) => {
            // Writing the devcontainer.json file
            const devcontainerConfig = {
                "name": devcontainerName,
                "dockerComposeFile": "docker-compose.yml",
                "service": "app",
                "workspaceFolder": "/workspaces/project/backend/",

                "customizations": {
                    // Configure properties specific to VS Code.
                    "vscode": {
                        // Add the IDs of extensions you want installed when the container is created.
                        "extensions": [
                            "rebornix.Ruby",
                            "wingrunr21.vscode-ruby",
                            "ms-azuretools.vscode-docker",
                            "esbenp.prettier-vscode",
                            "dbaeumer.vscode-eslint",
                            "github.github-vscode-theme",
                            "henriiik.vscode-sort",
                            "karunamurti.haml",
                            "iciclesoft.workspacesort",
                            "humao.rest-client",
                            "howardzuo.vscode-git-tags",
                            "shakram02.bash-beautify",
                            "rogalmic.bash-debug",
                            "bung87.rails",
                            "redhat.vscode-yaml",
                            "funkyremi.vscode-google-translate",
                            "mohd-akram.vscode-html-format",
                            "eamodio.gitlens",
                            "aliariff.vscode-erb-beautify",
                            "GrapeCity.gc-excelviewer",
                            "rebornix.ruby",
                            "jnbt.vscode-rufo",
                            "anweber.vscode-httpyac"
                        ]
                    }
                },
                "remoteUser": "vscode"
            }
            require('../libs/configs').writeJSONFile(devcontainerDir, 'devcontainer.json', devcontainerConfig);

            // Creating the docker-compose.yml file inside the .devcontainer directory
            const dockerComposeConfig = {
                "version": "3.9",
                "services": {
                    "app": {
                        "build": {
                            "context": "..",
                            "dockerfile": ".devcontainer/Dockerfile"
                        },
                        "volumes": [
                            "..:/workspaces/project/backend:cached",
                            "tmp:/workspaces/project/backend/tmp",
                            "bundle:/workspaces/project/backend/vendor/bundle",
                            "${HOME}/.bundle/config:/home/vscode/.bundle/config",
                            "/var/run/docker.sock:/var/run/docker.sock"
                        ],
                        "command": "sleep infinity",
                        "network_mode": "service:db",
                        "environment": {
                            "REDIS_URL": "redis://db:6379/1",
                            "DATABASE_URL": "postgres://postgres:postgres@db:5432/mytrack_dev?pool=5"
                        }
                    },
                    "redis": {
                        "image": "redis:latest",
                        "restart": "unless-stopped",
                        "command": "redis-server",
                        "network_mode": "service:db",
                        "healthcheck": {
                            "interval": "1s",
                            "retries": 30,
                            "test": "redis-cli ping",
                            "timeout": "3s"
                        }
                    },
                    "db": {
                        "image": "postgres:15-bookworm",
                        "restart": "unless-stopped",
                        "volumes": [
                            "postgres-data:/var/lib/postgresql/data",
                            "./create-db-user.sql:/docker-entrypoint-initdb.d/create-db-user.sql"
                        ],
                        "environment": {
                            "POSTGRES_USER": "postgres",
                            "POSTGRES_DB": "postgres",
                            "POSTGRES_PASSWORD": "postgres"
                        }
                    }
                },
                "volumes": {
                    "postgres-data": null,
                    "node-modules": null,
                    "tmp": null,
                    "bundle": null
                }
            }
            require('../libs/configs').writeYAMLFile(devcontainerDir, 'docker-compose.yml', dockerComposeConfig);

            // Creating the Dockerfile file inside the .devcontainer directory
            require('../libs/configs').writeTextFile(devcontainerDir, 'Dockerfile', "FROM gabrieletassoni/vscode-devcontainers-thecore:3");

            // Creating the create-db-user.sql file inside the .devcontainer directory
            require('../libs/configs').writeTextFile(devcontainerDir, 'create-db-user.sql', "CREATE USER vscode CREATEDB;\nCREATE DATABASE vscode WITH OWNER vscode;\nGRANT ALL PRIVILEGES ON DATABASE vscode TO vscode;");

            // Create the backend.code-workspace file
            const workspaceConfig = {
                "folders": [
                    {
                        "path": ".."
                    }
                ],
                "settings": {
                    "files.associations": {
                        "Gemfile.base": "gemfile"
                    }
                }
            };
            require('../libs/configs').writeJSONFile(devcontainerDir, 'backend.code-workspace', workspaceConfig);
        });
    } else {
        outputChannel.appendLine('.devcontainer directory already exists. I won\'t create it again since there could be a working configuration already setup.');
        vscode.window.showWarningMessage('.devcontainer directory already exists. I won\'t create it again since there could be a working configuration already setup.');
    }
}

// Make the following code available to the extension.js file
module.exports = {
    perform,
}