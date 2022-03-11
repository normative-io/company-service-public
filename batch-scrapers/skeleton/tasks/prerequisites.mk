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

# OS dependent prerequisites for MacOS
Darwin:
	brew update
	brew install pyenv pyenv-virtualenv

# OS dependent prerequisites for Linux
Linux:
	git clone https://github.com/pyenv/pyenv.git ~/.pyenv
	echo 'export PYENV_ROOT="$$HOME/.pyenv"' >> ~/.bash_profile
	echo 'export PATH="$$PYENV_ROOT/bin:$$PATH"' >> ~/.bash_profile
	echo 'eval "$$(pyenv virtualenv-init -)"' >> ~/.bash_profile
	exec "$(SHELL)"
	. ~/.bash_profile
	echo -e 'if command -v pyenv 1>/dev/null 2>&1; then\n  eval "$(pyenv init -)"\nfi' >> ~/.bash_profile

prerequisites-help:
	@echo ""
	@echo "Add pyenv virtualenv-init to your shell to enable auto-activation of virtualenvs."
	@echo ""
	@echo '  echo '\''eval "$$(pyenv virtualenv-init -)"'\'' >> ~/.bashrc'
	@echo ""
	@echo "If using zsh, consider using helper script: dev/chpwd-python-helper.zsh"
	@echo ""
