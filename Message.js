/* exports Message */
/* globals TL */

function Message($message)
{
	if(TL.estMP) {
		this.id_message = 'MP';
	} else if(TL.mobile) {
		var id = $message.attr('id');
		id = id.slice(id.indexOf('_') + 1);
		this.id_message = parseInt(id, 10);
	} else {
		this.id_message = parseInt($message.attr('data-id'), 10);
	}

	this.date = $(TL.class_date, $message).text().replace(/[\r\n]|#[0-9]+$/g, '');
	this.edition = $message.find('.info-edition-msg').text();
	this.$message = $message;
	this.pseudo = $('.bloc-pseudo-msg', $message).text().replace(/[\r\n]/g, '');
	this.supprime = false;
}

Message.prototype.afficher = function()
{
	TL.log('Affichage du message ' + this.id_message);
	this.$message.hide();
	this.fixBlacklist();
	this.fixCitation();
	this.fixDeroulerCitation();
	if(TL.mobile) {
		this.fixMobile();
	}
	$(TL.class_msg + ':last').after(this.$message);
	this.$message.fadeIn('slow');

	dispatchEvent(new CustomEvent('topiclive:newmessage', {
		'detail': {
			id: this.id_message,
			jvcake: TL.jvCake
		}
	}));
};

Message.prototype.fixBlacklist = function () {
	this.trouver('.bloc-options-msg > .picto-msg-tronche, .msg-pseudo-blacklist .btn-blacklist-cancel').on('click', function () {
		$.ajax({
			url: '/forums/ajax_forum_blacklist.php',
			data: {
				id_alias_msg: this.$message.attr('data-id-alias'),
				action: this.$message.attr('data-action'),
				ajax_hash: $('#ajax_hash_preference_user')
			},
			dataType: 'json',
			success: function(e) {
				if(e.erreur && e.erreur.length) {
					TL.alert(e.erreur);
				} else {
					document.location.reload();
				}
			}
		});
	});
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

Message.prototype.fixDeroulerCitation = function()
{
	this.trouver('blockquote').click(function() {
		$(this).attr('data-visible', '1');
	});
};

Message.prototype.fixMobile = function()
{
	this.trouver('.message').addClass('show-all');
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
	this.trouver(TL.class_contenu).html(nvMessage.trouver(TL.class_contenu).html());

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
