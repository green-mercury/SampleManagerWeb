RACINE_VERSION := $(shell							\
	while IFS=, read key value;						\
		do export $$key=$$value; 					\
	done < version.csv && echo $$RACINE_VERSION		\
)
RACINE_API_VERSION := $(shell						\
	while IFS=, read key value;						\
		do export $$key=$$value;					\
	done < version.csv && echo $$RACINE_API_VERSION	\
)

-include .github/workflows/module.mk
-include app/static/module.mk
-include desktop/module.mk
-include docker/module.mk
-include docs/module.mk
-include site/module.mk

.PHONY: version
version:
	@echo ${RACINE_VERSION}

.PHONY: api-version
api-version:
	@echo ${RACINE_API_VERSION}

app-deps: build/.app_deps_done
build/.app_deps_done: requirements.txt
	python -m pip install ${PIP_OPTIONS} --upgrade pip
	pip install ${PIP_OPTIONS} -r requirements.txt
	mkdir -p build
	touch build/.app_deps_done

app-dev-deps: build/.app_dev_deps_done
build/.app_dev_deps_done: requirements-dev.txt
	pip install ${PIP_OPTIONS} -r requirements-dev.txt
	mkdir -p build
	touch build/.app_dev_deps_done

.PHONY: api-spec
api-spec:
	python patches/generate-api-spec.py

build/openapi-generator-cli.jar:
	mkdir -p build
	wget https://repo1.maven.org/maven2/org/openapitools/openapi-generator-cli/6.2.1/openapi-generator-cli-6.2.1.jar \
		-O build/openapi-generator-cli.jar

.PHONY: api-client
api-client: api-spec build/openapi-generator-cli.jar
	rm -rf js/src/api	
	java -jar build/openapi-generator-cli.jar generate \
		-i docs/api.yaml -g javascript -p modelPropertyNaming=original -o js/src/api

install-mathjax:
	rm -rf app/static/mathjax

	git clone -b 2.7.1 --depth 1 \
		https://github.com/mathjax/MathJax.git \
		app/static/mathjax

	rm -rf app/static/mathjax/.git

install-js-dependencies: install-mathjax api-client
	mkdir -p app/static/css/fonts
	mkdir -p app/static/fonts
	mkdir -p app/static/webfonts

	# install typeahead.js
	wget -O js/src/typeahead/typeahead.bundle.js \
		https://raw.githubusercontent.com/twitter/typeahead.js/v0.11.1/dist/typeahead.bundle.js
	wget -O js/src/typeahead/bloodhound.js \
		https://raw.githubusercontent.com/twitter/typeahead.js/v0.11.1/dist/bloodhound.js
	wget -O app/static/css/typeahead.css \
		https://raw.githubusercontent.com/hyspace/typeahead.js-bootstrap3.less/v0.2.3/typeahead.css
	# c.f. https://github.com/hgrf/racine/commit/19fc41b1797112d2980b08ad53d1f945d9e36b17
	#      https://github.com/twitter/typeahead.js/issues/1218
	#      https://github.com/hgrf/racine/commit/2d892a4a2f6a9bdb9465730a64670277e35698a8
	git apply patches/typeahead.patch

	# install jeditable
	wget -O js/src/jquery-plugins/jquery.jeditable.js \
		https://sscdn.net/js/jquery/latest/jeditable/1.7.1/jeditable.js
	# c.f. https://github.com/hgrf/racine/commit/89d8b57e795ccfbeb73dc18faecc1d0016a8a008#diff-5f8e3a2bd35e7f0079090b176e06d0568d5c8e4468c0febbfa61014d72b16246
	git apply patches/jquery.jeditable.patch

	cd js && npm install && npx rollup -c

	cp js/node_modules/bootstrap/dist/css/bootstrap.min.css app/static/css/bootstrap.min.css
	cp js/node_modules/bootstrap/dist/fonts/* app/static/fonts/

	cp js/node_modules/bootstrap-icons/font/bootstrap-icons.css app/static/css/bootstrap-icons.css
	cp js/node_modules/bootstrap-icons/font/fonts/* app/static/css/fonts/

	cp js/node_modules/@fortawesome/fontawesome-free/css/fontawesome.min.css app/static/css/fontawesome.min.css
	cp js/node_modules/@fortawesome/fontawesome-free/css/regular.min.css app/static/css/regular.min.css
	cp js/node_modules/@fortawesome/fontawesome-free/css/solid.min.css app/static/css/solid.min.css
	cp js/node_modules/@fortawesome/fontawesome-free/css/brands.min.css app/static/css/brands.min.css
	cp js/node_modules/@fortawesome/fontawesome-free/webfonts/* app/static/webfonts/

	cp js/node_modules/tocbot/dist/tocbot.css app/static/css/tocbot.css

	cp js/node_modules/lightbox2/dist/css/lightbox.css app/static/css/lightbox.css
	cp js/node_modules/lightbox2/dist/images/* app/static/images/

js-version:
	cd js && npm version --allow-same-version ${RACINE_VERSION}
	cd desktop && npm version --allow-same-version ${RACINE_VERSION}

run-no-docker:
	flask run --debug

.PHONY: test
test:
	coverage run -m pytest

.PHONY: coverage-report
coverage-report: test
	coverage html

.PHONY: black
black:
	black .

.PHONY: black-check
black-check:
	black . --check

.PHONY: flake8
FLAKE_EXTRA_ARGS ?=	--exit-zero
flake8:
	# stop the build if there are Python syntax errors or undefined names
	flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics

	# make sure flake8 report folder exists
	mkdir -p ./reports/flake8

	# make sure no previous report exists (otherwise flake8 will append to it)
	rm ./reports/flake8/flake8stats.txt || true

	# run flake8 and generate report
	flake8 . \
		--format=html --htmldir ./reports/flake8/ \
		--tee --output-file ./reports/flake8/flake8stats.txt \
		${FLAKE_EXTRA_ARGS}

.PHONY: flake8-check
flake8-check:
	FLAKE_EXTRA_ARGS= make flake8

.PHONY: eslint
eslint:
	cd js && npx eslint --max-warnings 0 .
