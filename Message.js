function Message($message)
{
	if(TL.estMP) this.id_message = 'MP';
	else 				 this.id_message = parseInt($message.attr('data-id'), 10);

	this.date = $('.bloc-date-msg', $message).text().replace(/[\r\n]|#[0-9]+$/g, '');
	this.edition = $message.find('.info-edition-msg').text();
	this.$message = $message;
	this.pseudo = $('.bloc-pseudo-msg', $message).text().replace(/[\r\n]/g, '');
	this.supprime = false;
}

Message.prototype.afficher = function()
{
	TL.log('Affichage du message ' + this.id_message);
	this.$message.hide();
	this.fixCitation();
	$('.bloc-message-forum:last').after(this.$message);
	this.$message.fadeIn('slow');

	dispatchEvent(new CustomEvent('topiclive:newmessage', {
		'detail': {
			id: this.id_message,
			jvcake: TL.jvCake
		}
	}));
};

Message.prototype.fixCitation = function()
{
	TL.log('Obtention de la citation du message ' + this.id_message);
	this.$message.find('.bloc-options-msg .picto-msg-quote').on('click', (function() {
		$.ajax({
			type: 'POST',
			url: '/forums/ajax_citation.php',
			data: {
				id_message: this.id_message,
				ajax_timestamp: TL.ajaxTs,
				ajax_hash: TL.ajaxHash
			},
			dataType: 'json',
			timeout: 5000,
			success: (function(e) {
				TL.log('Citation du message ' + this.id_message + ' recue avec succes');
				var $msg = TL.formu.obtenirMessage();
				var nvmsg = '> Le ' + this.date + ' ' + this.pseudo + ' a écrit :\n>';
				nvmsg += e.txt.split('\n').join('\n> ') + '\n\n';
				if($msg.val() === '') {
					$msg.val(nvmsg);
				} else {
					$msg.val($msg.val() + '\n\n' + nvmsg);
				}
			}).bind(this),
			error: this.fixCitation.bind(this)
		});
	}).bind(this));
};

Message.prototype.trouver = function(chose)
{
	return this.$message.find(chose);
};

// Change le CSS du message pour indiquer qu'il est supprime
Message.prototype.supprimer = function()
{
	TL.log('Alerte suppression du message ' + this.id_message);
	if(!this.supprime) {
		this.trouver('.bloc-options-msg').hide();

		// Clignotement du messages
		this.$message.animate({
			backgroundColor: '#3399FF'
		}, 50);
		this.$message.animate({
			backgroundColor: '#D1F0FF'
		}, 500);

		this.supprime = true;
	}
};

Message.prototype.update = function(nvMessage)
{
	if(this.edition == nvMessage.edition) return;
	TL.log('Message ' + this.id_message + ' edite : mise a jour');

	this.edition = nvMessage.edition;
	this.trouver('.bloc-contenu').html(nvMessage.trouver('.bloc-contenu').html());

	dispatchEvent(new CustomEvent('topiclive:edition', {
		'detail': {
			id: this.id_message,
			jvcake: TL.jvCake
		}
	}));

	// Clignotement du messages
	var defColor = this.$message.css('backgroundColor');
	this.$message.animate({
		backgroundColor: '#FF9900'
	}, 50);
	this.$message.animate({
		backgroundColor: defColor
	}, 500);
};
