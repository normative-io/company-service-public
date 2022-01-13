export PYENV_VIRTUALENV_DISABLE_PROMPT=1
export PYENV_ROOT="$HOME/.pyenv"
export PATH="$PYENV_ROOT/bin:$PATH"
eval "$(pyenv init --path)"
eval "$(pyenv init -)"
eval "$(pyenv virtualenv-init -)"

autoload -U add-zsh-hook

load-python-version() {
	local ver=`pyenv local 2>/dev/null`
	if [[ "$ver" != "" ]] ; then
		RPROMPT="%F{magenta}"
		RPROMPT+=" $ver"
		RPROMPT+="%f"
	fi
}

add-zsh-hook chpwd load-python-version
load-python-version
