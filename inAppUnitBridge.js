  /* eslint-disable no-underscore-dangle, no-console */

  let interactionElement;
  const mongoIdRegex = /^[a-f\d]{24}$/i;

  const blackListEvents = {
    AD_CLOSED: 'apester_ad_closed',
    AD_OPEN: 'apester_ad_open',
    SLIDE_LOADED: 'slide_loaded',
    RESIZE: 'apester_resize_unit',
    SEND_INTERACTIONS: 'send-intersections',
  };
  const changeInteractionUrl = {
    FEED_NEXT_UNIT: 'move_to_next_interaction',
    STORY_LOADED: 'apester_interaction_loaded',
  };

  const changeInteractionState = {
    FULLSCREEN_ON: 'fullscreen_on',
    PAUSE: 'player_pause',
    RESUME: 'player_resume',
    RESTART: 'restart_unit',
  };

  const INIT_INAPP_PARAMS = 'init_inapp_params';

  let adHeight = 0;
  const mobileEventList = {
    RESIZE: 'apester_resize_unit',
    VIEWABILITY_CHANGE: 'apester_view_status_change',
  };

  const unitSize = {
    height: 450,
    width: 0,
  };

  const latestSizeSent = {
    height: 0,
    width: 0,
  };

  const getParamsFromUrl = () => {
    const url = new URL(window.location);
    const urlSearchParams = new URLSearchParams(url.search);
    return Object.fromEntries(urlSearchParams);
  };

  const getMediaIdFromPath = () => {
    const lastParthOfPath = window.location.pathname.split('/').pop();
    if (lastParthOfPath.match(mongoIdRegex)) {
      return lastParthOfPath;
    }
    return '';
  };

  const init = (inAppParams, isInitFromEvent) => {
    const params = inAppParams || getParamsFromUrl();

    const {
      mediaId = getMediaIdFromPath(),
      channelToken,
      gdprString,
      noApesterAds,
      fallback,
      context,
      tags,
      autoFullscreen,
      isSandBoxMode,
      agencyName,
      agencyImage,
    } = params;

    if (!mediaId && !channelToken) {
      const handler = (event) => {
        const { data } = event || {};
        const { type: eventType } = data || {};
        if (!data || !eventType) {
          return;
        }
        if (eventType === INIT_INAPP_PARAMS) {
          const { params: eventParams } = data;
          init(eventParams, true);
          window.removeEventListener('message', handler);
        }
      };
      window.addEventListener('message', handler);
      return;
    }

    if (!window.__tcfapi) {
      window.__tcfapi = (command, version, cb) => {
        if (['getTCData', 'addEventListener'].includes(command) === false) {
          return;
        }
        const success = !!gdprString;
        const TCData = {
          tcfPolicyVersion: 2,
          eventStatus: 'tcloaded',
          gdprApplies: success,
          tcString: gdprString || undefined,
        };
        cb(TCData, success);
      };
    }

    interactionElement = channelToken ? document.createElement('interaction') : document.createElement('div');

    infoElement = document.createElement('div');
    infoElement.innerHTML = JSON.stringify(params);
    
    if (noApesterAds && noApesterAds === 'true') {
      window.__noApesterAds = true;
    }

    if (mediaId) {
      interactionElement.setAttribute('data-media-id', `${mediaId}`);
      interactionElement.className = 'apester-media';
    } else if (channelToken) {
      interactionElement.setAttribute('data-token', `${channelToken}`);
      interactionElement.setAttribute('data-fallback', `${fallback}`);
      interactionElement.setAttribute('data-context', `${context}`);
      interactionElement.setAttribute('tags', `${tags}`);
    }

    if (autoFullscreen) {
      interactionElement.setAttribute('data-auto-fullscreen', true);
    }

    if (isSandBoxMode) {
      interactionElement.setAttribute('sandbox-mode', true);
    }

    if (agencyName && agencyImage) {
      interactionElement.setAttribute('agency-data', `{"agencyName": "${agencyName}", "agencyImage": "${agencyImage}"}`);
    }

    window.document.body.appendChild(interactionElement);

    if (isInitFromEvent) {
      window.APESTER.reload();
    }
  };

  const sendEventToApp = (eventData) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    (window.Android && window.Android.apesterUnitProxy(JSON.stringify(eventData)))
      || (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.apesterUnitProxy.postMessage(JSON.stringify(eventData)));
  };

  const sendResizeEvent = (heightToUpdate, widthToUpdate, isFinalSizeForInApp = false) => {
    if (latestSizeSent.height !== heightToUpdate || latestSizeSent.width !== widthToUpdate || isFinalSizeForInApp) {
      latestSizeSent.height = heightToUpdate;
      latestSizeSent.width = widthToUpdate;

      const event = {
        height: heightToUpdate,
        width: widthToUpdate,
        type: mobileEventList.RESIZE,
        isFinalSizeForInApp,
      };
      sendEventToApp(event);
    }
  };
  window.__APESTER_DEFFERED_AD_LOAD = true;

  window.addEventListener('message', (event) => {
    const eventData = event.data;
    if (!eventData || !eventData.type) { return; }
    const { type: eventType } = eventData;
    if (eventType === blackListEvents.AD_OPEN || eventType === blackListEvents.AD_CLOSED) {
      adHeight = eventType === blackListEvents.AD_OPEN ? eventData.size.height : 0;
      sendResizeEvent(unitSize.height + adHeight, unitSize.width);
      console.log(`Send ${eventType} to proxy`);
      return;
    }

    if (eventType === blackListEvents.RESIZE) {
      sendResizeEvent(eventData.height + adHeight, eventData.width, eventData.isFinalSizeForInApp);
      unitSize.height = eventData.height;
      unitSize.width = eventData.width;
      console.log(`Send ${eventType} to proxy`);
      return;
    }

    if (eventType === changeInteractionUrl.STORY_LOADED || eventType === changeInteractionUrl.FEED_NEXT_UNIT) {
      const interactionId = eventData?.interactionId ?? eventData?.nextInteraction?.interactionId;

      const pathWithoutUnitId = window.location.pathname.split('/').filter((e) => !e.match(mongoIdRegex));
      const newPath = pathWithoutUnitId.join('/');

      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      window.history.pushState(params, 'Apester Story', `${newPath}/${interactionId}`);
    }

    if (
      eventType !== blackListEvents.SEND_INTERACTIONS
    ) {
      console.log(`Send ${eventType} to proxy`);

      sendEventToApp(eventData);
    }
  });

  window.__sendApesterEvent = (event) => {
    try {
      window.postMessage(event, '*');
    } catch (e) {
      console.log('error parsing json');
    }
  };

  window.__getHeight = () => unitSize.height + adHeight;

  window.__setApesterViewabiity = (isVisible, initialInteractionId) => {
    try {
      const event = {
        type: mobileEventList.VIEWABILITY_CHANGE,
        isVisible,
        initialInteractionId,
      };
      window.postMessage(event, '*');
    } catch (e) {
      console.log('error parsing json');
    }
  };

  window.__apesterIsVisible = () => (
    (window.Android && window.Android.isVisible && window.Android.isVisible())
    || (window.webkit
      && window.webkit.messageHandlers
      && window.webkit.messageHandlers.validateUnitViewVisibity
      && window.webkit.messageHandlers.validateUnitViewVisibity.postMessage('')
      && false) /** ios update async */
  );

  // full screen "story slide progress" support

  window.__storyResume = () => {
    if (!interactionElement) return;
    const event = { type: changeInteractionState.RESUME };
    interactionElement.querySelector('iframe').contentWindow.postMessage(event, '*');
  };

  window.__storyPause = () => {
    if (!interactionElement) return;
    const event = { type: changeInteractionState.PAUSE };
    interactionElement.querySelector('iframe').contentWindow.postMessage(event, '*');
  };

  window.__storyRestart = () => {
    if (!interactionElement) return;
    const event = { type: changeInteractionState.RESTART };
    interactionElement.querySelector('iframe').contentWindow.postMessage(event, '*');
  };
  // end of full screen "story slide progress" support
  const params = window.__getInitParams ? window.__getInitParams() : undefined;

  init(params);
