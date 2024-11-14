import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import bodyParser from 'body-parser';
import bcrypt from 'bcrypt';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import session from 'express-session';
import methodOverride from 'method-override';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const port = 3000;

const MODEL_NAME = "gemini-1.0-pro";
const API_KEY = "AIzaSyAOYVq2PVpulzVk86bgG0APxRpfGssL8z0";  

const GENERATION_CONFIG = {
    temperature: 0.9,
    topK: 1,
    topP: 1,
    maxOutputTokens: 2048,
};

const SAFETY_SETTINGS = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

const urlMongo = 'mongodb://127.0.0.1:27017';
const nomeBanco = 'sistemaLogin';
const dbName = 'Gerenciamento';
const paccollectionName = 'pacientes';

app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(methodOverride('_method'));

app.use(session({
    secret: 'segredo-super-seguro',
    resave: false,
    saveUninitialized: true
}));


app.post('/cadastro', async (req, res) => {
    const novopaciente = req.body;
    const client = new MongoClient(urlMongo);
    try {
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection(paccollectionName);
        const result = await collection.insertOne(novopaciente);
        console.log(`dica cadastrado com sucesso. ID: ${result.insertedId}`);
        res.redirect('/p');
    } catch (err) {
        console.error('Erro ao cadastrar o dica:', err);
        res.status(500).send('Erro ao cadastrar o dica. Por favor, tente novamente mais tarde.');
    } finally {
        client.close();
    }
});

app.get('/paciente/:id', async (req, res) => {
    const { id } = req.params;
    const client = new MongoClient(urlMongo);
    try {
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection(paccollectionName);
        const paciente = await collection.findOne({ _id: new ObjectId(id) });
        if (!paciente) {
            return res.status(404).send('dica não encontrado');
        }
        res.json(paciente);
    } catch (err) {
        console.error('Erro ao buscar o dica:', err);
        res.status(500).send('Erro ao buscar o dica. Por favor, tente novamente mais tarde.');
    } finally {
        client.close();
    }
});


app.get('/atualizar', (req, res) => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const filePath = path.join(__dirname, 'public', 'atualizarsustentabilidade.html');
    res.sendFile(filePath);
});



app.post('/atualizar', async (req, res) => {
    const { id, titulo, desc, url_foto } = req.body;
    const client = new MongoClient(urlMongo);

    try {
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection(paccollectionName);

        const result = await collection.updateOne(
            { _id: new ObjectId(id) },
            {
                $set: {
                    titulo, desc, url_foto
                }
            }
        );

        if (result.modifiedCount > 0) {
            console.log(`dica com ID: ${id} atualizado com sucesso.`);
            res.redirect('/p');
        } else {
            res.status(404).send('dica não encontrado.');
        }
    } catch (err) {
        console.error('Erro ao atualizar o dica:', err);
        res.status(500).send('Erro ao atualizar o dica. Por favor, tente novamente mais tarde.');
    } finally {
        client.close();
    }
});


app.post('/deletar', async (req, res) => {
    const { id } = req.body;
    const client = new MongoClient(urlMongo);
    try {
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection(paccollectionName);

        const result = await collection.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount > 0) {
            console.log(`dica com ID: ${id} deletado com sucesso.`);
            res.redirect('/p');
        } else {
            res.status(404).send('dica não encontrado.');
        }
    } catch (err) {
        console.error('Erro ao deletar o dica:', err);
        res.status(500).send('Erro ao deletar o dica. Por favor, tente novamente mais tarde.');
    } finally {
        client.close();
    }
});


app.get('/paciente/:titulo', async (req, res) => {
    const { titulo } = req.params;
    const client = new MongoClient(urlMongo);
    try {
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection(paccollectionName);

        const paciente = await collection.findOne({ titulo: (titulo) });
        if (!paciente) {
            return res.status(404).send('dica não encontrado');
        }
        res.json(paciente);
    } catch (err) {
        console.error('Erro ao buscar o dica:', err);
        res.status(500).send('Erro ao buscar o dica. Por favor, tente novamente mais tarde.');
    } finally {
        client.close();
    }
});


app.get('/pacientes', async (req, res) => {
    const client = new MongoClient(urlMongo);
    try {
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection(paccollectionName);
        const pacientes = await collection.find({}, { projection: { id: 1, titulo: 1, desc: 1, url_foto: 1 } }).toArray();
        res.json(pacientes);
    } catch (err) {
        console.error('Erro ao buscar dica:', err);
        res.status(500).send('Erro ao buscar dica. Por favor, tente novamente mais tarde.');
    } finally {
        client.close();
    }
});

app.post('/chat', async (req, res) => {
    const userInput = req.body.message;
    try {
        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });
        const chat = model.startChat({
            generationConfig: GENERATION_CONFIG,
            safetySettings: SAFETY_SETTINGS,
            history: [],
        });

        const result = await chat.sendMessage(userInput);
        if (result.error) {
            return res.status(500).json({ error: result.error.message });
        }
        res.json({ response: result.response.text() });
    } catch (error) {
        console.error('Erro no chat:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});


app.get('/registro', (req, res) => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const filePath = path.join(__dirname, 'views', 'registro.html');
    res.sendFile(filePath);
});


app.post('/registro', async (req, res) => {
    const cliente = new MongoClient(urlMongo, { useUnifiedTopology: true });
    try {
        await cliente.connect();
        const banco = cliente.db(nomeBanco);
        const colecaoUsuarios = banco.collection('usuarios');
        const usuarioExistente = await colecaoUsuarios.findOne({ usuario: req.body.usuario });

        if (usuarioExistente) {
            res.send('Usuário já existe! Tente outro nome de usuário.');
        } else {
            const senhaCriptografada = await bcrypt.hash(req.body.senha, 10);
            await colecaoUsuarios.insertOne({
                usuario: req.body.usuario,
                senha: senhaCriptografada
            });
            res.redirect('/login');
        }
    } catch (erro) {
        res.send('Erro ao registrar o usuário.');
    } finally {
        cliente.close();
    }
});

app.get('/login', (req, res) => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const filePath = path.join(__dirname, 'views', 'login.html');
    res.sendFile(filePath);
});



app.post('/login', async (req, res) => {
    const cliente = new MongoClient(urlMongo, { useUnifiedTopology: true });
    try {
        await cliente.connect();
        const banco = cliente.db(nomeBanco);
        const colecaoUsuarios = banco.collection('usuarios');
        const usuario = await colecaoUsuarios.findOne({ usuario: req.body.usuario });

        if (usuario && await bcrypt.compare(req.body.senha, usuario.senha)) {
            req.session.usuario = req.body.usuario;
            res.redirect('/bemvindo');
        } else {
            res.redirect('/erro');
        }
    } catch (erro) {
        res.send('Erro ao realizar login.');
    } finally {
        cliente.close();
    }
});

function protegerRota(req, res, proximo) {
    if (req.session.usuario) {
        proximo();
    } else {
        res.redirect('/login');
    }
}

app.get('/bemvindo', protegerRota, (req, res) => {
    const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const filePath = path.join(__dirname, 'views', 'bemvindo.html');
res.sendFile(filePath);
});



app.get('/erro', (req, res) => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const filePath = path.join(__dirname, 'views', 'erro.html');
    res.sendFile(filePath);
});


app.get('/sair', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.send('Erro ao sair!');
        }
        res.redirect('/login');
    });
});

app.get('/chat', (req, res) => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const filePath = path.join(__dirname, 'public', 'chat.html');
    res.sendFile(filePath);
});



app.get('/p', (req, res) => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const filePath = path.join(__dirname, 'public', 'dadossustentabilidade.html');
    res.sendFile(filePath);
});


app.get('/cadastro', (req, res) => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const filePath = path.join(__dirname, 'public', 'adicionarsustentabilidade.html');
    res.sendFile(filePath);
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + 'telainicial.html');
});

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});
