# VR Game

## Task 1. Movement by teleporting

### Task 1.1 Create teleports and add them to the scene
![](docs/task_1.1.png)

### Task 1.2 Display teleports when squeeze button is pressed
![](docs/task_1.2.png)

### Task 1.3 Hide teleports when squeeze button is released
![](docs/task_1.3.png)

### Task 1.4 Redraw teleports with update method
![](docs/task_1.4.png)

### Task 1.5 Define if controller pointing on teleport

#### Task 1.5.1 Add teleports cylinders to the collisionObjects 
![](docs/task_1.5.1.png)

#### Task 1.5.2 Highlight and store intersected teleport
![](docs/task_1.5.2.png)

#### Task 1.6 On select press move to the selected teleport
![](docs/task_1.6.png)

## Task 2. Interacting with meshes
- In the render loop, call update for each interactable mesh.
- Add meshes to the list of collisionObjects for selecting them by the controllers.
- Update the intersectObjects method to add the interactable to the controller's userData object.
- Update the onSelectStart function to handle the interactable.

### Task 2.1 Store and configure interactable meshes
#### TASK 2.1.1 Create empty array for storing interacting meshes
![](docs/task_2.1.1.png)

#### TASK 2.1.2 Check if mesh is interacting
![](docs/task_2.1.2.png)

#### TASK 2.1.3 Store if object is interacting meshes
![](docs/task_2.1.3.png)

## Task 3. Using a controller as a weapon