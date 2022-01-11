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
