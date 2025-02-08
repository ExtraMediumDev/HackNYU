import { ScrollView, View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from "react-native";
import { Link } from "expo-router";

const TILE_SIZE = Dimensions.get('window').width / 2 - 24;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  logo: {
    width: 32,
    height: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 8,
    color: '#585858',
  },
  content: {
    padding: 16,
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#585858',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#888',
    marginBottom: 24,
    lineHeight: 24,
  },
  tilesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    marginBottom: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tileContent: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  tileTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  tileDescription: {
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
  },
  style1: { backgroundColor: '#f2849e' },
  style2: { backgroundColor: '#7ecaf6' },
  style3: { backgroundColor: '#7bd0c1' },
  style4: { backgroundColor: '#c75b9b' },
  style5: { backgroundColor: '#ae85ca' },
  style6: { backgroundColor: '#8499e7' },
});

const tiles = [
  { id: 1, title: 'Magna', style: styles.style1 },
  { id: 2, title: 'Lorem', style: styles.style2 },
  { id: 3, title: 'Feugiat', style: styles.style3 },
  { id: 4, title: 'Tempus', style: styles.style4 },
  { id: 5, title: 'Aliquam', style: styles.style5 },
  { id: 6, title: 'Veroeros', style: styles.style6 },
  { id: 7, title: 'Ipsum', style: styles.style2 },
  { id: 8, title: 'Dolor', style: styles.style3 },
  { id: 9, title: 'Nullam', style: styles.style1 },
  { id: 10, title: 'Ultricies', style: styles.style5 },
  { id: 11, title: 'Dictum', style: styles.style6 },
  { id: 12, title: 'Pretium', style: styles.style4 },
];

export default function Index() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Image 
          source={require('../assets/images/logo.svg')}
          style={styles.logo}
        />
        <Text style={styles.title}>Phantom</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.heading}>
          This is Phantom, a free, fully responsive site template designed by HTML5 UP.
        </Text>
        <Text style={styles.description}>
          Etiam quis viverra lorem, in semper lorem. Sed nisl arcu euismod sit amet nisi euismod sed cursus arcu elementum ipsum arcu vivamus quis venenatis orci lorem ipsum et magna feugiat veroeros aliquam.
        </Text>

        <View style={styles.tilesContainer}>
          {tiles.map((tile) => (
            <Link
              key={tile.id}
              href="/generic"
              asChild
            >
              <TouchableOpacity style={StyleSheet.flatten([styles.tile, tile.style])}>
                <View style={styles.tileContent}>
                  <Text style={styles.tileTitle}>{tile.title}</Text>
                  <Text style={styles.tileDescription}>
                    Sed nisl arcu euismod sit amet nisi lorem etiam dolor veroeros et feugiat.
                  </Text>
                </View>
              </TouchableOpacity>
            </Link>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}