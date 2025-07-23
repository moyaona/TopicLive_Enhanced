# TopicLive_Enhanced

## Introduction

TopicLive_Enhanced est le projet de reprise et d'amélioration du script TopicLive par Kiwec.
C'est un userscript pour jeuxvideo.com qui charge les messages des forums en direct. Plus besoin de rafraichir la page !
Une icone s'affichera dans l'onglet en question pour indiquer le nombre de nouveaux messages, ainsi qu'un bouton sur la page pour accéder automatiquement aux nouveaux messages.

## Installation

- Installez ViolentMonkey ou Tampermonkey.

- Installez TopicLive_Enhanced en [cliquant ici](https://github.com/moyaona/TopicLive_Enhanced/raw/main/TopicLive_Enhanced.user.js) (Vous obtiendrez les dernières màj automatiquement)

## Améliorations par rapport au script original

- Fix du favicon jvc qui ne s'affichait pas de suite en chargeant un topic
- Modification esthétique du compteur de nouveaux messages en favicon
- Ajout d'un compteur de nouveaux messages décrémentiel en favicon qui s'actualise en fonction des nouveaux messages lus
- Ajout d'un bouton "Nouveaux Messages" sur la page qui comptabilise également le nombre de nouveaux messages et présente un compteur décrémentiel.
Ce bouton permet d'accéder directement en scrollant aux derniers messages postés.
- Fix des citations pour les nouveaux messages chargés
- Exclusion du script des MP
- Fix de l'audio et remplacement par une notification plus douce
- Ajout d'options de personnalisation (activer Son, Compteur favicon, Bouton "Nouveaux Messages")
- Ajout d'un logo pour le script

## Améliorations envisagées

- Permettre le fonctionnement du script sur toutes les pages d'un topic et pas uniquement la dernière
- Faire fonctionner le script pour l'actualisation des MP


## Développement

Si vous cherchez а̀ rendre votre userscript compatible avec TopicLive, lisez [API.md](https://git.kiwec.net/kiwec/TopicLive/src/master/API.md).
Si vous souhaitez contribuer а̀ TopicLive, conservez le style actuel (tabulations pour l'indentation...), c'est tout !
