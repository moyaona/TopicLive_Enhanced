function Message($message)
{
	this.id_message = parseInt($message.attr('data-id'), 10);
	this.date = $('.bloc-date-msg', $message).text().replace(/[\r\n]|#[0-9]+$/g, '');
	this.edition = $message.find('.info-edition-msg').text();
	this.$message = $message;
	this.pseudo = $('.bloc-pseudo-msg', $message).text().replace(/[\r\n]/g, '');
	this.supprime = false;

	// TL.log('new message ' + this.id_message);
}

Message.prototype.afficher = function()
{
	TL.log('message.afficher : ' + this.id_message);
	this.$message.hide();
	this.fixCitation();
	replace_spoilers(this.$message[0]);
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
	TL.log('message.fixCitation : ' + this.id_message);
	this.$message.find('.bloc-options-msg .picto-msg-quote').on('click', function() {
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
			success: function() {
				this.obtenirMessage().val('> Le ' + date + ' ' + pseudo +
								' a écrit :\n>' + e.txt.split('\n').join('\n> ') +
								'\n\n' + this.obtenirMessage().val());
			},
			error: this.fixCitation
		});
	});
};

Message.prototype.maj = function(nvMessage)
{
	// TL.log('message.maj : ' + this.id_message);
	if(this.edition == nvMessage.edition) return;

	this.edition = nvMessage.edition;
	this.trouver('.bloc-contenu').html(nvMessage.trouver('.bloc-contenu').html());

	dispatchEvent(new CustomEvent('topiclive:edition', {
		'detail': {
			id: this.id_message,
			jvcake: TL.jvCake
		}
	}));

	// Clignotement du messages
	var defColor = $message.css('backgroundColor');
	this.$message.animate({
		backgroundColor: '#FF9900'
	}, 50);
	this.$message.animate({
		backgroundColor: defColor
	}, 500);
};

Message.prototype.trouver = function(chose)
{
	TL.log('message.trouver : ' + chose);
	return this.$message.find(chose);
};

// Change le CSS du message pour indiquer qu'il est supprime
Message.prototype.supprimer = function()
{
	TL.log('message.supprimer : ' + this.id_message);
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
