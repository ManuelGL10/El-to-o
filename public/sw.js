
const APP_SHELL_CACHE = 'appShell'; //Nombre de la caché principal
const DYNAMIC_CACHE = 'dynamic'; // Nombre de la caché dinamica
// Array de las rutas de los archivos esenciales
const APP_SHELL = [
    '/index.html',
    '/manifest.json',   
    '/error.jpeg', 
    '/icon/mevan32.jpg',
    '/icon/mevan64.jpg',
    '/icon/mevan128.jpg',
    '/icon/mevan256.jpg',
    '/icon/mevan512.jpg',
    '/icon/mevan1024.jpg',
];

// Instalación del Service Worker y cacheo de archivos principales (app shell)
self.addEventListener('install', (event) => {
    event.waitUntil(
      caches.open(APP_SHELL_CACHE).then((cache) => {
        console.log('Caching app shell');
    
      })
    );
});

// Activación del SW y limpieza de cachés
self.addEventListener('activate', (event) => {
    //Obtiene los nombres de las caches almacenadas 
    caches.keys().then((keys) => 
        keys
            .filter((keys) => key !== APP_SHELL_CACHE && key !== DYNAMIC_CACHE)
            .map((key) => caches.delete(key)) // Borra los caches que no sean actuales 
    )
}); 

// Listener para push
self.addEventListener('push', event => {
    let data = { title: 'Tortitas el buen amigo', body: 'Nuevo mensaje' };

    if (event.data) {
        console.log("Contenido del evento push:", event.data.text()); // Verifica qué se recibe
        try {
            data = event.data.json();
        } catch (error) {
            console.error("Error al parsear el JSON:", error);
            data.body = event.data.text();
            console.log(data.body)
        }
    }

    const opciones = {
        body: data.body,
        icon: '/icon/mevan1024.jpg',
        silent: null
    };

    self.registration.showNotification(data.title, opciones);
});

self.addEventListener('fetch', event => {
    const resp = fetch(event.request).then(respuesta => {
        if (!respuesta) {
            // Si la respuesta no existe, buscamos en el cache
            return caches.match(event.request).then(cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse;
                } else {
                    // Si no está en el cache, retornamos una imagen de error desde el cache
                    return caches.match('/public/error.jpeg');
                }
            });
        } else {
            // Si la respuesta existe, la almacenamos en el cache dinámico
            return caches.open(DYNAMIC_CACHE).then(cache => {
                cache.put(event.request.url, respuesta.clone());
                return respuesta;
            });
        }
    }).catch(err => {
        // Si ocurre un error (por ejemplo, si no hay conexión), buscamos en el cache
        return caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
                return cachedResponse;
            } else {
                // Si no está en el cache, retornamos la imagen de error
                return caches.match('/public/error.jpeg');
            }
        });
    });

    event.respondWith(resp);
});

// Sincronización en segundo plano 
self.addEventListener('sync', event => {
    console.log('Sync event triggered', event);

    if (event.tag === 'sync-cocina'){
        syncPets();
    }
}); 

// Funcion para sincronizar datos de IndexedDB
function syncPets() {
    return new Promise((resolve, reject) => {
        const dbRequest = indexedDB.open('dishDB')
        
        dbRequest.onsuccess = event => {
            const db = event.target.result; 
            const transaction = db.transaction('dishes', 'readonly');
            const objectStore = transaction.objectStore('dishes');
            const getAllRequest = objectStore.getAll();

            getAllRequest.onsuccess = () => {
                const pets = getAllRequest.result;

                if(pets.length === 0){
                    console.log('No hay tareas para sincronizar.'); 
                }

                // Enviar cada tarea al backend
                const promises = pets.map(pet => {
                    return fetch('https://tortas-server.onrender.com/post_cocina', {
                        method: 'POST',
                        headers : {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(pet)
                    })
                    .then(response => {
                        if(!response.ok){
                            throw new Error('Error en la API'); 
                        }
                        return response.json();
                    })
                    .then(data => {
                        console.log('Tarea sincronizada con éxito:', data);
                        eliminarPet(pet.id);
                    })
                    .catch(error => {
                        console.error('Error al sincronizar tarea:', error);
                    });
                });

                Promise.all(promises).then(() => resolve()).catch(reject);
            };

            getAllRequest.onerror = event => {
                console.error('Error al obtener tareas de IndexedDB', event);
                reject();
            };
        };

        dbRequest.onerror = event => {
            console.error('Error al abrir la base de datos:', event);
            reject();
        };
    });
}


// Función para elimanar usuarios de IndexedDB
function eliminarPet(id){
    const request = indexedDB.open('dishDB'); 

    request.onerror = (event) => {
        console.error('Error abriendo la base de datos', event); 
    }; 

    request.onsuccess = (event) => {
        const db = event.target.result; 
        const transaction = db.transaction('dishes', 'readwrite');
        const objectStore = transaction.objectStore('dishes'); 
        const deleteRequest = objectStore.delete(id); 

        deleteRequest.onsuccess = () => {
            console.log(`Registro con id ${id} eliminado`); 
        };
    };
}  
