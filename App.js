import React, { useRef } from 'react';

import {
  Button,
  KeyboardAvoidingView,
  SafeAreaView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  MediaStream,
  mediaDevices,
} from 'react-native-webrtc';
import { useState } from 'react';

import io from 'socket.io-client';

const SignalServer = 'http://192.168.0.187:9000';

export const WSEvent = {
  connected: 'connected',
  ready: 'ready',
  message: 'message',
  error: 'error',
  close: 'close',
}

const App = () => {
  const [remoteStream, setRemoteStream] = useState(null);
  const [webcamStarted, setWebcamStarted] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [userId, setUserId] = useState('long');
  const [channelId, setChannelId] = useState('LongVideo');
  const pc = useRef();
  const servers = {
    iceServers: [
      {
        urls: [
          'stun:stun1.l.google.com:19302',
          'stun:stun2.l.google.com:19302',
        ],
      },
    ],
    iceCandidatePoolSize: 10,
  };

  const startWebcam = async () => {
    connectSocketIO();

    pc.current = new RTCPeerConnection(servers);
    const local = await mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    pc.current.addStream(local);
    setLocalStream(local);
    const remote = new MediaStream();
    setRemoteStream(remote);

    // Push tracks from local stream to peer connection
    local.getTracks().forEach(track => {
      console.log(pc.current.getLocalStreams());
      pc.current.getLocalStreams()[0].addTrack(track);
    });

    // Pull tracks from remote stream, add to video stream
    pc.current.ontrack = event => {
      event.streams[0].getTracks().forEach(track => {
        remote.addTrack(track);
      });
    };

    pc.current.onaddstream = event => {
      setRemoteStream(event.stream);
    };

    setWebcamStarted(true);
  };

  const startCall = async () => {

    pc.current.onicecandidate = async event => {
      if (event.candidate) {
        send('ice-candidate', event.candidate);
      }
    };

    //create offer
    const offerDescription = await pc.current.createOffer();
    await pc.current.setLocalDescription(offerDescription);

    const offer = {
      sdp: offerDescription.sdp,
      type: offerDescription.type,
    };

    send('offer', offer);
  };

  const joinCall = async () => {

    pc.current.onicecandidate = async event => {
      if (event.candidate) {
        send('ice-candidate', event.candidate);
      }
    };

    const answerDescription = await pc.current.createAnswer();
    await pc.current.setLocalDescription(answerDescription);

    const answer = {
      type: answerDescription.type,
      sdp: answerDescription.sdp,
    };

    send('answer', answer);
  };

  const socketIO = useRef(null);

  const handleConnected = () => {
    socketIO.current.emit('join', userId);
  };

  const handleOffer = (data) => {
    pc.current.setRemoteDescription(
      new RTCSessionDescription(data),
    );
  }

  const handleAnswer = (data) => {
    const answerDescription = new RTCSessionDescription(data);
    pc.current.setRemoteDescription(answerDescription);
  }

  const handleICECandiate = (data) => {
    pc.current.addIceCandidate(new RTCIceCandidate(data));
  }

  const handleSignal = message => {
    try {
      const data = message;
      if (data.from == userId) return;
      switch (data.signal) {
        case 'offer':
          return handleOffer(data.message);
        case 'answer':
          return handleAnswer(data.message);
        case 'ice-candidate':
          return handleICECandiate(data.message);
      }
    } catch (e) { }
  };

  const send = (signal, message) => {
    if (socketIO?.current) {
      const data = ({
        from: userId,
        to: channelId,
        signal,
        message
      })
      socketIO.current.emit('message', data)
    }
  }

  const connectSocketIO = () => {
    socketIO.current = io(SignalServer);

    socketIO.current.on(WSEvent.connected, handleConnected);
    socketIO.current.on(WSEvent.message, handleSignal);
  }

  return (
    <KeyboardAvoidingView style={styles.body} behavior="position">
      <SafeAreaView>
        {localStream && (
          <RTCView
            streamURL={localStream?.toURL()}
            style={styles.stream}
            objectFit="cover"
            mirror
          />
        )}

        {remoteStream && (
          <RTCView
            streamURL={remoteStream?.toURL()}
            style={styles.stream}
            objectFit="cover"
            mirror
          />
        )}
        <View style={styles.buttons}>
          {!webcamStarted && (
            <View>
              <TextInput
                value={userId}
                placeholder="userId"
                minLength={45}
                style={{ borderWidth: 1, padding: 5 }}
                onChangeText={newText => setUserId(newText)}
              />
              <Button title="Start webcam" onPress={startWebcam} />
            </View>
          )}
          {webcamStarted && <Button title="Start call" onPress={startCall} />}
          {webcamStarted && (
            <View style={{ flexDirection: 'row' }}>
              <Button title="Join call" onPress={joinCall} />
              <TextInput
                value={channelId}
                placeholder="callId"
                minLength={45}
                style={{ borderWidth: 1, padding: 5 }}
                onChangeText={newText => setChannelId(newText)}
              />
            </View>
          )}
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  body: {
    backgroundColor: '#fff',

    justifyContent: 'center',
    alignItems: 'center',
    ...StyleSheet.absoluteFill,
  },
  stream: {
    flex: 2,
    width: 200,
    height: 200,
  },
  buttons: {
    alignItems: 'flex-start',
    flexDirection: 'column',
  },
});

export default App;
