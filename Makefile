FILES=Favicon.js Formulaire.js Message.js Option.js Page.js TopicLive.js

# Rassemble les fichiers pour debug facilement
build:
	cat $(FILES) > topiclive.test.js
