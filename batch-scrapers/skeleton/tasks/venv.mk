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
