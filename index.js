const express = require("express");
const bodyParser = require('body-parser');
const speech = require('@google-cloud/speech');
const multer = require('multer');
const fs = require("fs");
const ffmpeg = require('fluent-ffmpeg')
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const server = express();
server.use(bodyParser.json({ extended: true, limit: "50mb" }));
server.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const client = new speech.SpeechClient();

server.post("/audio", async (req, res,next) => {
  const { audio } = req.body;

  try {
    fs.writeFileSync("./download/teste.m4a", audio, { encoding: "base64" });

    const responseText = await quickstart(); // Aguarde a conclusão da tradução
    console.log("final: "+responseText);
    res.status(200).json({texto: responseText});

  } catch (error) {
    next(error);
  }
});

async function quickstart() {
  try {
    const responseText = await new Promise((resolve, reject) => {
      ffmpeg()
        .input("./download/teste.m4a")
        .audioFilter('pan=mono|c0=c0')
        .audioCodec("flac")
        .toFormat("flac")
        .save("./audio/teste123.flac")
        .on("end", async () => {
          const text = await sendAudioToText();
          resolve(text); // Resolva a promessa após a tradução
        })
        .on("error", (err) => {
          reject(err); // Rejeite a promessa em caso de erro
        });
    });

    if(responseText && responseText.trim().length === 0){
      const erroCustom = new Error("audio incompreensivo");
      erroCustom.name = "vazio";
      erroCustom.statusCode = 1;
      throw erroCustom;
    }
    return responseText; // Retorne o texto traduzido
  } catch (err) {
    throw err;
  }
}

async function sendAudioToText() {
  const audioFile = fs.readFileSync("./audio/teste123.flac").toString("base64");

  const audio = {
    content: audioFile,
  };
  const config = {
    encoding: 'FLAC',
    languageCode: 'pt-BR',
    audioChannelCount: 1,
    sampleRateHertz: 44100
  };
  const request = {
    audio: audio,
    config: config,
  };

  try {
    const [response] = await client.recognize(request);
    const transcription = response.results
      .map(result => result.alternatives[0].transcript)
      .join('\n');

    console.log(`Transcription: ${transcription}`);
    return transcription;
  } catch (error) {
    console.error('Erro no reconhecimento de fala:', error);
    throw error;
  }
}

server.use((err,req,res,next)=>{
  if(err.statusCode === 1){
    res.status(422).send(err.message);
  }else{
    res.status(500).send(err.message);
  }
});

server.listen(8080, "127.0.0.1", () => {
  console.log("server executando!");
});
