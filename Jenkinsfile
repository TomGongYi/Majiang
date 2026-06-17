pipeline {
    agent any

    tools {
        nodejs 'node20'
    }
    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
        skipDefaultCheckout(true)
    }

    parameters {
        string(name: 'BRANCH_NAME', defaultValue: 'master', trim: true,
               description: 'Git branch to build')
    }

    environment {
        REPOSITORY_URL = 'https://github.com/TomGongYi/Majiang.git'
        APP_DIR = 'Majiang-master'
        NODEJS_BIN = '/var/jenkins_home/tools/jenkins.plugins.nodejs.tools.NodeJSInstallation/node20/bin'
    }

    stages {
        stage('Checkout') {
            steps {
                deleteDir()
                checkout([
                    $class: 'GitSCM',
                    branches: [[name: "*/${params.BRANCH_NAME ?: 'master'}"]],
                    extensions: [[
                        $class: 'CloneOption',
                        depth: 1,
                        noTags: true,
                        shallow: true,
                        timeout: 10
                    ]],
                    userRemoteConfigs: [[url: env.REPOSITORY_URL]]
                ])
            }
        }

        stage('Validate') {
            steps {
                sh '''
                    set -eu
                    export PATH="$NODEJS_BIN:$PATH"

                    # 如果仓库根目录没有 Majiang-master，就自动使用当前目录
                    if [ ! -d "$APP_DIR" ] && [ -f package.json ]; then
                        APP_DIR="."
                    fi

                    test -f "$APP_DIR/package.json" || {
                        echo "package.json not found. Please check APP_DIR."
                        echo "Current workspace files:"
                        ls -la
                        exit 1
                    }

                    command -v node >/dev/null 2>&1 || {
                        echo "Node.js is required on the Jenkins agent."
                        exit 1
                    }

                    command -v npm >/dev/null 2>&1 || {
                        echo "npm is required on the Jenkins agent."
                        exit 1
                    }

                    node -v
                    npm -v
                '''
            }
        }

        stage('Build Web App') {
            steps {
                sh '''
                    set -eu
                    export PATH="$NODEJS_BIN:$PATH"

                    if [ ! -d "$APP_DIR" ] && [ -f package.json ]; then
                        APP_DIR="."
                    fi

                    cd "$APP_DIR"

                    if [ -f package-lock.json ]; then
                        npm ci --no-audit --no-fund
                    else
                        npm install --no-audit --no-fund
                    fi

                    npm run release

                    test -f dist/index.html || {
                        echo "Build failed: dist/index.html not found."
                        exit 1
                    }
                '''
            }
        }
        stage('Run Web') {
            steps {
                sh '''
                    set -eu
                    export PATH=/var/jenkins_home/tools/jenkins.plugins.nodejs.tools.NodeJSInstallation/node20/bin:$PATH

                    cd Majiang-master

                    pkill -f "http-server dist" || true

                    npm install -g http-server

                    JENKINS_NODE_COOKIE=dontKillMe nohup http-server dist -a 0.0.0.0 -p 8081 > app.log 2>&1 &

                    sleep 2
                    cat app.log
                '''
             }
        }

        stage('Archive Dist') {
            steps {
                // archiveArtifacts artifacts: "Majiang-master/dist/**/*", fingerprint: true, allowEmptyArchive: true
                archiveArtifacts artifacts: "Majiang-master/dist/**/*", fingerprint: true, allowEmptyArchive: true
            }
        }
    }

    post {
        success {
            echo "Majiang build completed successfully."
        }
        failure {
            echo "Majiang build failed. Check stage output."
        }
    }
}
