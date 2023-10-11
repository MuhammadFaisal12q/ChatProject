import React, { useState, useEffect } from "react";
import { StyleSheet, View, Text, FlatList, TouchableOpacity } from 'react-native';
import { HubConnectionBuilder } from '@microsoft/signalr';
import { Bubble, GiftedChat, Time } from 'react-native-gifted-chat';
import { Chat, MessageType } from '@flyerhq/react-native-chat-ui';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons'
import AudioRecorderPlayer, { AVEncoderAudioQualityIOSType, AVEncodingOption, AudioEncoderAndroidType, AudioSourceAndroidType, OutputFormatAndroidType } from 'react-native-audio-recorder-player';
import { SvgXml } from 'react-native-svg';

import { GLOBAL_STYLE, STYLE_STRING } from "../../../styles";
import { AXIOS, FUNCTION, MOCK_API, RESOURCE, STRING } from "../../../utils";
import { connect } from "react-redux";
import { AppHeaderView, ButtonView } from "../../../reusables";
import RNFetchBlob from "rn-fetch-blob";
import { sendMessage } from "@microsoft/signalr/dist/esm/Utils";

const player = new AudioRecorderPlayer();

const ShopkeeperCareChattingScreen = (props) => 
{
  const [shouldRender, setShouldRender] = useState(false);

  const [isLoading, setIsLoading] = useState(false);

  const [isRecording, setIsRecording] = useState(false);

  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const [recordingDuration, setRecordingDuration] = useState(0);

  const [audioFilePath, setAudioFilePath] = useState(null);

  const [audioDurationUI, setAudioDurationUI] = useState('');

  const dirs = RNFetchBlob.fs.dirs;

  const messages = props.redux_shopkeeperCare?.messages;

  const HandleRecording = async (state) =>  
  {
    if (isRecording)
    {
      const result = await player?.stopRecorder();

      setAudioFilePath(result);

      state == 1 && await SendAudioMessage(result);

      player?.removeRecordBackListener();
      
      setIsRecording(false);
      
      console.log(`stopRecording() = ${JSON.stringify(result)}`);
    }
    
    else 
    {
      const path = `${dirs.CacheDir}/vlc_${props.redux_auth_user?.id}_${props.redux_shopkeeperCare?.messages?.receiver_Id}_${new Date().getTime().toString()}.mp3`;
      
      await player?.startRecorder(path, {});

      setIsRecording(true); 
    }
  }

  useEffect(() => 
  {
    FUNCTION.RequestPermission_Recording();

    player.setSubscriptionDuration(0.5);
    
  }, []);

  useEffect(() => 
  {
    let interval = setInterval(() => 
    {
      if (isRecording)
      {
        setRecordingDuration(r => r +1)
      }

    }, 1000);

    return () => clearInterval(interval);

  }, [isRecording, recordingDuration]);

  useEffect(() => 
  {
    !isRecording && setRecordingDuration(0);

  }, [isRecording]);

  useEffect(() => 
  { 
    ReadMessages();
  
  }, [props.redux_shopkeeperCare?.messages]);

  function StopAudioMessage() 
  {
    player.stopPlayer();

    setIsPlayingAudio(false);
    
    setAudioDurationUI('');
    
    player.removePlayBackListener();
  }

  // function GiveMessageObj(msg) 
  // {
  //   return {
  //     _id: msg?.id,
  //     text: msg?.message_Text,
  //     createdAt: msg?.createdDate,
  //     user: 
  //     {
  //       _id: msg?.sender_Id || msg?.id,
  //       name: messages?.vizUserContactName,
  //       avatar: messages?.vizUserContactLogo,
  //     },
  //   }
  // }

  // function GiveMessages() 
  // {
  //   var t = [];

  //   messages?.lastMessages?.map(msg => {
  //     if (t?.find(i => i.id == msg.id)) 
  //       return;

  //     t.push({
  //       _id: msg?.id,
  //       text: msg?.message_Text,
  //       createdAt: msg?.createdDate,
  //       user: 
  //       {
  //         _id: msg?.sender_Id || msg?.id,
  //         name: messages?.vizUserContactName,
  //         avatar: messages?.vizUserContactLogo,
  //       },
  //     })
  //   });

  //   return t;
  // }
  
  async function PlayAudioMessage(audio) 
  {
    setIsPlayingAudio(true);

    await player?.stopPlayer();

    await player?.startPlayer(audio).then(() => 
    {
      player.addPlayBackListener(event => 
      {
        const c = (Math.floor(event.currentPosition /1000));
        const e = (Math.floor(event.duration /1000));

        // setAudioDurationUI(`${(Math.floor(c /60))?.toString().padStart(2, '0') + ":" + (c %60)?.toString().padStart(2, '0')} / ${(Math.floor(e /60))?.toString().padStart(2, '0') + ":" + (e %60)?.toString().padStart(2, '0')}`);

        setAudioDurationUI(`${player.mmss(c)} / ${player.mmss(e)}`);

        setTimeout(() => 
        {
          if (event.currentPosition == event.duration)
          {
            player?.stopPlayer();

            setIsPlayingAudio(false);
            
            setAudioDurationUI('');
            
            player?.removePlayBackListener();
          }

        }, STRING.COMMON.TIMEOUT.NEGLIGIBLE);
      });
    }).catch(error => 
    {
      FUNCTION.ShowAlert_Snackbar(error?.message ?? 'Audio file not found...', STYLE_STRING.COLOR.ERROR);

      console.log(`error = ${JSON.stringify(error)}`)

      player?.stopPlayer();

      setIsPlayingAudio(false);
      
      setAudioDurationUI('');
      
      player?.removePlayBackListener();
    })
  }

  function GiveMessages() 
  {
    const list = messages?.lastMessages?.map(msg => 
    {
      return {
        _id: msg?.id,
        text: msg?.message_Text,
        createdAt: msg?.createdDate,
        user: 
        {
          _id: msg?.sender_Id || msg?.id,
          name: messages?.vizUserContactName,
          avatar: messages?.vizUserContactLogo,
        },
        messageType: msg?.message_Type,
      }
    });

    console.log(`list = ${JSON.stringify(list)}`)

    return list;
  }

  async function ReadMessages() 
  {
    const unreadMessages = messages?.lastMessages?.filter(msg => (msg?.sender_Id != props.redux_auth_user.id && msg?.isRead == false));

    if (unreadMessages?.length)
    {
      await props.redux_shopkeeperCare?.connection?.invoke('MarkMessagesRead', unreadMessages)
      .then(() => 
      {
        var c = props.redux_shopkeeperCare?.chats?.map(chat => chat?.id == messages?.id ? {

          ...chat,
          lastMessages: chat?.lastMessages?.map(msg => 
          {
            if (msg?.sender_Id != props.redux_auth_user?.id)
            {
              return { ...msg, isRead: true }
            }

            return msg
          }),
          unreadMessages: 0,

        } : chat);

        props.Redux_SaveChats(c);
        props.Redux_SaveMessages(c?.find(i => i?.id == messages?.id));
      })
    }

    setShouldRender(true);
  }

  async function SendMessage(message) 
  {
    if (!FUNCTION.IsEmptyString(message)) 
    {
      const newMsg = 
      {
        message,
        senderId: props.redux_auth_user.id,
        receiverId: messages?.receiver_Id,
        vizUserChatId: messages?.id,
      }

      await props.redux_shopkeeperCare?.connection?.invoke('SendMessage', newMsg);
    }
  }

  async function SendAudioMessage(audioPath) 
  {
    if (!FUNCTION.IsEmptyString(audioPath)) 
    {
      /*
        _id: string | number;
        text: string;
        createdAt: Date | number;
        user: User;
        image?: string;
        video?: string;
        audio?: string;
        system?: boolean;
        sent?: boolean;
        received?: boolean;
        pending?: boolean;
        quickReplies?: QuickReplies;
      */

      const newMsg = 
      {
        message: audioPath,
        audio: true,
        // audio: audioFilePath,
        senderId: props.redux_auth_user.id,
        receiverId: messages?.receiver_Id,
        vizUserChatId: messages?.id,
        message_Type: 'audio',
      }
      
      await props.redux_shopkeeperCare?.connection?.invoke('SendMessage', newMsg);
    }
  }

function IsReachingTop({ layoutMeasurement, contentOffset, contentSize })
{
    const paddingToTop = 80;
    return contentSize.height - layoutMeasurement.height - paddingToTop <= contentOffset.y;

    // return contentOffset.y <= 100; // 100px from top
}

function CheckAndFetchMoreMessages() 
{
  if (isLoading == false && messages?.lastMessages?.length < messages?.totalMessages) 
  {
    setIsLoading(true);

    AXIOS.post
    (
      'api/VizUserChatMessage/GetChatMessages', 
      {
        skipRecord: messages?.lastMessages?.length,
        vizUserChat_Id: messages?.lastMessages[0]?.vizUserChat_Id,
      }
    )
    .then(({ data }) =>
      {
        FUNCTION.Dev_ResponseInfo(STRING.AGENT.SCREEN.PROFILE_TAB, 'FetchAgentProfile() - line: 50, section: 02', data);

        // let list_m = [...messages?.lastMessages, ...data?.response?.messagesList];

        props.Redux_SaveChats(
          props.redux_shopkeeperCare?.chats?.map(i => 
            i?.id == messages?.id 
            ? 
            {
              ...i, 
              lastMessages: [...messages?.lastMessages, ...data?.response?.messagesList]
            } 
            : i
          )
        );

        props.Redux_SaveMessages({ ...messages, 
          lastMessages: [...messages?.lastMessages, ...data?.response?.messagesList]
        });

        setIsLoading(false);
      })
      .catch(exception => 
        FUNCTION.HideAlert_Wait(() => 
        {
          setIsLoading(false);

          FUNCTION.HandleThisExceptionPlease
          (
            exception, 
            STRING.AGENT.SCREEN.PROFILE_TAB, 
            'FetchAgentProfile() - line: 63, section: 02', 
            STRING.AGENT.ERROR.FETCH_PROFILE
          ); 
        })
      );
  }
}

  return (
    <View style={{ ...GLOBAL_STYLE.container, paddingHorizontal: '0%', paddingVertical: '0%', }}>
      {
        shouldRender 
        && 
        <>
          <AppHeaderView
            headerText={`${messages?.receiverName}`}
          />
          <GiftedChat
            renderBubble={bubble => {
              return <Bubble
                {...bubble}
                // renderCustomView={() => !FUNCTION.IsEmptyString(bubble.currentMessage?.audio) && <ButtonView/>}
                renderCustomView={() => bubble.currentMessage?.messageType == 'audio' && <ButtonView/>}
                wrapperStyle={{
                  left: { backgroundColor: STYLE_STRING.COLOR.LIGHT_GRAY_ONE },
                  right: { backgroundColor: STYLE_STRING.COLOR.THEME },
                }}
                textStyle={{
                  left: { color: STYLE_STRING.COLOR.BLACK, },
                  right: { color: STYLE_STRING.COLOR.WHITE, }
                }}
                renderTime={time => 
                  <Text
                    style={[{ fontSize: 10, color: time.position == 'left' ? STYLE_STRING.COLOR.GRAYISH_BLACK : STYLE_STRING.COLOR.PINKISH_WHITE, marginVertical: 6, paddingHorizontal: 10, }]}
                  >
                    {FUNCTION.ConvertDateTo12HoursTime(time.currentMessage.createdAt)}
                  </Text>
                }
              /> 
            }}
            listViewProps={{
            scrollEventThrottle: 400,
            onScroll: ({ nativeEvent }) => {
              if (IsReachingTop(nativeEvent)) {
                CheckAndFetchMoreMessages();
              }
            }
            }}
            // messages={messages?.lastMessages?.map(i => GiveMessageObj(i))}
            // messages={GiveMessages()}
            messages={MOCK_API.MESSAGES}
            onSend={message => SendMessage(message[0].text)}
            user={{ _id: props.redux_auth_user.id }}
            alwaysShowSend={!isRecording}
            inverted
            loadEarlier={(messages?.lastMessages?.length > 0 && messages.lastMessages?.length < messages?.totalMessages)}
            isLoadingEarlier={isLoading}
            onLoadEarlier={() => CheckAndFetchMoreMessages()}
            // renderActions={() => 
            //   <View style={{ borderWidth: 1, borderColor: 'red', }}>

            //   </View>
            // }
            renderMessageAudio={({ currentMessage }) => 
            {
              return <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: '2%', paddingTop: '2%', }}>
                <Text style={{ ...localStyleSheet.contactText, paddingHorizontal: '2%', color: 'white', fontSize: 12, }}>{audioDurationUI}</Text>
                <TouchableOpacity
                  style={{ alignSelf: 'flex-end', paddingHorizontal: '2%', paddingVertical: '1%', }}
                  activeOpacity={0.65}
                  onPress={() => isPlayingAudio ? StopAudioMessage() : PlayAudioMessage(currentMessage?.audio)}
                >
                  <MaterialIcons
                    name={isPlayingAudio ? 'pause-circle-outline' : 'play-circle-outline'}
                    size={35}
                    color={'white'}
                  />
                </TouchableOpacity>
              </View>
            }}
            renderAccessory={() => 
              <View style={{ width: '92%', flexDirection: 'row', alignSelf: 'center', justifyContent: 'space-between', alignItems: 'center' }}>
                {
                  isRecording 
                  ? 
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'flex-start', }}>
                      <Text style={localStyleSheet.time}>
                        {/* {(Math.floor(recordingDuration /60))?.toString().padStart(2, '0') + ":" + (recordingDuration %60)?.toString().padStart(2, '0')} */}
                        {player.mmss(recordingDuration)}
                      </Text>
                    </View>

                  : 
                    <View style={{ flex: 1 }}/>
                }

                <TouchableOpacity
                  style={{ padding: '2%' }}
                  activeOpacity={0.65}
                  onPress={() => HandleRecording(0)}
                >
                  <MaterialIcons
                    name={isRecording ? 'stop' : 'mic'}
                    color={isRecording ? 'red' : STYLE_STRING.COLOR.THEME}
                    size={STYLE_STRING.ICON_SIZE._30}
                  />
                </TouchableOpacity>

                {
                  isRecording 
                  ?  
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'flex-end', }}>
                      <TouchableOpacity
                        style={{ padding: '2%' }}
                        activeOpacity={0.65}
                        onPress={() => {
                          HandleRecording(1);
                        }}
                      >
                        <MaterialIcons
                          name={'done'}
                          color={STYLE_STRING.COLOR.THEME}
                          size={STYLE_STRING.ICON_SIZE._30}
                        />
                      </TouchableOpacity>
                    </View> 
                  : 
                  <View style={{ flex: 1 }}/>
                }
              </View>
            }
          />
        </>
      }
    </View>
  );
}

const localStyleSheet = StyleSheet.create
({
  contactView: 
  {
    flex: 1, flexDirection: 'row', minHeight: 60, alignItems: 'center', 
    paddingVertical: 8,
  },

  contactText: 
  {
    flex: 1, color: STYLE_STRING.COLOR.BLACK, 
    fontFamily: STYLE_STRING.FONT_FAMILY.Inter.Font_Medium, fontSize: STYLE_STRING.FONT_SIZE._14, 
    textAlignVertical: 'center', 
  },

  contactMessage: 
  {
    flex: 1, color: STYLE_STRING.COLOR.GRAYISH_BLACK, 
    fontFamily: STYLE_STRING.FONT_FAMILY.Inter.Font_Regular, fontSize: STYLE_STRING.FONT_SIZE._12, 
    textAlignVertical: 'center', 
  },

  contactMessageTime: 
  {
    flex: 1, color: STYLE_STRING.COLOR.GRAYISH_BLACK, lineHeight: STYLE_STRING.OTHER.LINE_HEIGHT +4, 
    fontFamily: STYLE_STRING.FONT_FAMILY.Inter.Font_Regular, fontSize: STYLE_STRING.FONT_SIZE._12, 
    textAlignVertical: 'center', textAlign: 'right',
  },

  time: 
  {
    color: STYLE_STRING.COLOR.GRAYISH_BLACK, 
    fontFamily: STYLE_STRING.FONT_FAMILY.Inter.Font_Medium, fontSize: STYLE_STRING.FONT_SIZE._14, 
    textAlignVertical: 'center', 
  },
});

const mapStateToProps = state => 
{
  return {
    redux_auth_user: state.auth.user,
    redux_shopkeeperCare: state.shopkeeperCare,
  };
};

const mapDispatchToProps = dispatch => 
{
  return {
    Redux_SaveContacts: contacts => dispatch({ type: STRING.SHOPKEEPER.REDUX_ACTION.CARE_CONTACTS, payload: contacts }),
    Redux_SaveChats: chats => dispatch({ type: STRING.SHOPKEEPER.REDUX_ACTION.CARE_CHATS, payload: chats }),
    Redux_SaveMessages: messages => dispatch({ type: STRING.SHOPKEEPER.REDUX_ACTION.CARE_MESSAGES, payload: messages }),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(ShopkeeperCareChattingScreen);