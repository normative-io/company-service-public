# Copyright 2022 Meta Mind AB
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

# Chosen python version
PYTHON_VERSION=3.9.9

# Virtualenv specific folders, and python binary
VENV_DIR=$(shell pyenv root)/versions/${VENV}
PYTHON_BIN=${VENV_DIR}/bin
PYTHON=${VENV_BIN}/python

# Helper for activating pyenv virtualenv
# See https://github.com/pyenv/pyenv-virtualenv/issues/372
ACTIVATE=source $(PYTHON_BIN)/activate ${VENV};

# Create virtualenv directory
$(VENV_DIR):
	pyenv install -s ${PYTHON_VERSION}
	pyenv virtualenv ${PYTHON_VERSION} ${VENV}
	echo ${VENV} > .python-version

clean-venv:
	pyenv virtualenv-delete -f ${VENV} || true
	rm -f .python-version
