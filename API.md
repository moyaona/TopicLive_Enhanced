# Pour un script simple

Il vous suffit de rajouter un listener qui appelle votre main.

```javascript
addEventListener('topiclive:newmessage', main);
```

# Pour un script avancé

## Obtenir le message

Ici, impossible d'utiliser le main. Il vous faudra créer une nouvelle fonction.

```javascript
addEventListener('topiclive:newmessage', function(event){
	// L'id du message est stocké dans event.detail.id
	var message = document.getElementById(event.detail.id);
});
```

## Annuler l'affichage du message

```javascript
addEventListener('topiclive:newmessage', function(event){
	if(blablabla) {
		// Appeler cette méthode moins d'une seconde après l'event annulera l'affichage du message
		event.detail.cancel();
	}
});
```

## Contourner JvCare

Pour récupérer les liens dans un message, il vous faudra contourner JvCare. Chaque lien est un `span`.
Vous devez envoyer le `class` de ce span а̀ JvCake pour obtenir le lien.

```javascript
addEventListener('topiclive:newmessage', function(event){
var message = document.getElementById(event.detail.id);
var spans = message.getElementsByTagName('span');
var liens = [];

for(var i = 0; i < spans.length; i++)
{
	var lienEncrypte = spans[i].className;
	// JvCake est stocké dans event.detail.jvcake
	var lienDecrypte = event.detail.jvcake(lienEncrypte);
	liens.push(lienDecrypte);
}
});
```

## Quand un message est édité

Le procédé est le même que pour obtenir un message :

```javascript
addEventListener("topiclive:edition", function(event){
	// ...
});
```

## Attendre le post-process

Si votre script a besoin d'avoir le message avec les citations, spoilers et liens corrigés, vous pouvez attendre que TopicLive ait fini de charger les messages.
Attention, cette opération est déclenchée environ toutes les 5 secondes.

```javascript
var nouveauxMessages = [];

addEventListener("topiclive:newmessage", function(event){
	nouveauxMessages.push(event.detail.id);
});

addEventListener("topiclive:doneprocessing", function(){
	// ...
});
```
