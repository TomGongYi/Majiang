pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
        skipDefaultCheckout(true)
    }

    parameters {
        string(name: 'BRANCH_NAME', defaultValue: 'master', trim: true,
               description: 'Git branch to deploy')
        string(name: 'HOST_PORT', defaultValue: '8080', trim: true,
               description: 'Host port exposed by the nginx container')
        string(name: 'CONTAINER_NAME', defaultValue: 'majiang-web', trim: true,
               description: 'Name of the production Docker container')
    }

    environment {
        REPOSITORY_URL = 'https://github.com/TomGongYi/Majiang.git'
        APP_DIR = 'Majiang-master'
        IMAGE_NAME = 'majiang-web'
        NODE_IMAGE = 'node:20-alpine'
        NGINX_IMAGE = 'nginx:1.27-alpine'
    }

    stages {
        stage('Checkout') {
            steps {
                deleteDir()
                checkout([
                    $class: 'GitSCM',
                    branches: [[name: "*/${params.BRANCH_NAME}"]],
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
                    command -v docker >/dev/null 2>&1 || {
                        echo "Docker is required on the Jenkins agent."
                        exit 1
                    }
                    test -f "$APP_DIR/package.json"
                    test -f "$APP_DIR/package-lock.json"

                    case "$HOST_PORT" in
                        ''|*[!0-9]*)
                            echo "HOST_PORT must be a number."
                            exit 1
                            ;;
                    esac
                    test "$HOST_PORT" -ge 1 && test "$HOST_PORT" -le 65535

                    case "$CONTAINER_NAME" in
                        ''|*[!A-Za-z0-9_.-]*)
                            echo "CONTAINER_NAME contains unsupported characters."
                            exit 1
                            ;;
                    esac

                    docker version >/dev/null
                '''
            }
        }

        stage('Build Web App') {
            steps {
                sh '''
                    set -eu
                    docker run --rm \
                        --user "$(id -u):$(id -g)" \
                        -e HOME=/tmp \
                        -e npm_config_cache=/tmp/npm-cache \
                        -v "$WORKSPACE/$APP_DIR:/app" \
                        -w /app \
                        "$NODE_IMAGE" \
                        sh -ec 'npm ci --no-audit --no-fund && npm run release && test -f dist/index.html'
                '''
                archiveArtifacts artifacts: "${env.APP_DIR}/dist/**/*",
                                 fingerprint: true
            }
        }

        stage('Build Nginx Image') {
            steps {
                sh '''
                    set -eu
                    cat > "$WORKSPACE/.Dockerfile.majiang" <<EOF
FROM ${NGINX_IMAGE}
COPY . /usr/share/nginx/html/
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1/index.html || exit 1
EOF
                    docker build --pull \
                        --tag "$IMAGE_NAME:$BUILD_NUMBER" \
                        --file "$WORKSPACE/.Dockerfile.majiang" \
                        "$APP_DIR/dist"
                '''
            }
        }

        stage('Smoke Test Image') {
            steps {
                sh '''
                    set -eu
                    test_container="${CONTAINER_NAME}-test-${BUILD_NUMBER}"
                    cleanup() {
                        docker rm -f "$test_container" >/dev/null 2>&1 || true
                    }
                    trap cleanup EXIT

                    docker run -d --name "$test_container" "$IMAGE_NAME:$BUILD_NUMBER" >/dev/null
                    attempts=0
                    until docker exec "$test_container" \
                            wget -q -O /dev/null http://127.0.0.1/index.html
                    do
                        attempts=$((attempts + 1))
                        if [ "$attempts" -ge 10 ]; then
                            echo "Container smoke test failed."
                            exit 1
                        fi
                        sleep 1
                    done
                '''
            }
        }

        stage('Deploy') {
            steps {
                sh '''
                    set -eu
                    image="$IMAGE_NAME:$BUILD_NUMBER"
                    old_image="$(docker inspect --format '{{.Config.Image}}' "$CONTAINER_NAME" 2>/dev/null || true)"

                    rollback() {
                        echo "Rolling back deployment."
                        docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
                        if [ -n "$old_image" ]; then
                            docker run -d --restart unless-stopped \
                                --name "$CONTAINER_NAME" \
                                -p "$HOST_PORT:80" \
                                "$old_image" >/dev/null || true
                        fi
                    }

                    docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
                    if ! docker run -d --restart unless-stopped \
                            --name "$CONTAINER_NAME" \
                            -p "$HOST_PORT:80" \
                            "$image" >/dev/null
                    then
                        rollback
                        exit 1
                    fi

                    attempts=0
                    until docker exec "$CONTAINER_NAME" \
                            wget -q -O /dev/null http://127.0.0.1/index.html
                    do
                        attempts=$((attempts + 1))
                        if [ "$attempts" -ge 10 ]; then
                            rollback
                            exit 1
                        fi
                        sleep 1
                    done

                    docker tag "$image" "$IMAGE_NAME:latest"
                    echo "Deployment ready on port $HOST_PORT."
                '''
            }
        }
    }

    post {
        always {
            sh '''
                docker rm -f "${CONTAINER_NAME}-test-${BUILD_NUMBER}" >/dev/null 2>&1 || true
                rm -f "$WORKSPACE/.Dockerfile.majiang"
            '''
        }
        success {
            echo "Majiang deployment completed successfully."
        }
        failure {
            echo "Majiang deployment failed. Check stage output and rollback status."
        }
    }
}
